use crate::db::get_conn;
use crate::models::{
    ExportData, ExportExerciseSession, ExportExerciseSessionPhrase, ExportMaterial,
    ExportMaterialThread, ExportPhrase, ExportPhraseThread, ExportPracticeSession, ExportSetting,
    ExportTag, ImportMode, ImportResult, ImportStats,
};
use rusqlite::{params, Connection};
use std::collections::HashMap;

#[tauri::command]
pub fn import_data(data: ExportData, mode: ImportMode) -> Result<ImportResult, String> {
    let mut conn = get_conn()?;
    import_data_with_conn(&mut conn, data, mode)
}

/// Core import logic that can be tested with any connection
pub fn import_data_with_conn(
    conn: &mut Connection,
    data: ExportData,
    mode: ImportMode,
) -> Result<ImportResult, String> {
    if data.version > 5 {
        return Err(format!(
            "Export version {} is not supported. Please update the application.",
            data.version
        ));
    }

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let mut stats = ImportStats::default();

    match mode {
        ImportMode::Overwrite => {
            for table in &[
                "phrase_tags",
                "tags",
                "exercise_session_phrases",
                "exercise_sessions",
                "practice_sessions",
                "phrase_threads",
                "material_threads",
                "phrases",
                "materials",
                "settings",
            ] {
                tx.execute(&format!("DELETE FROM {table}"), [])
                    .map_err(|e| format!("Failed to delete {table}: {}", e))?;
            }

            for setting in &data.settings {
                import_setting(&tx, setting, false)?;
                stats.settings_imported += 1;
            }
            for material in &data.materials {
                insert_material(&tx, material, true)?;
                stats.materials_imported += 1;
            }
            for phrase in &data.phrases {
                insert_phrase(&tx, phrase, true, None)?;
                stats.phrases_imported += 1;
            }
            for thread in &data.phrase_threads {
                insert_phrase_thread(&tx, thread, true, thread.phrase_id)?;
                stats.phrase_threads_imported += 1;
            }
            for thread in &data.material_threads {
                insert_material_thread(&tx, thread, true, thread.material_id)?;
                stats.material_threads_imported += 1;
            }
            for session in &data.practice_sessions {
                insert_practice_session(&tx, session, true, session.material_id)?;
                stats.practice_sessions_imported += 1;
            }
            for tag in &data.tags {
                insert_tag(&tx, tag, true)?;
                stats.tags_imported += 1;
            }
            for pt in &data.phrase_tags {
                tx.execute(
                    "INSERT OR IGNORE INTO phrase_tags (phrase_id, tag_id) VALUES (?1, ?2)",
                    params![pt.phrase_id, pt.tag_id],
                )
                .map_err(|e| format!("Failed to import phrase_tag: {}", e))?;
                stats.phrase_tags_imported += 1;
            }
            for session in &data.exercise_sessions {
                insert_exercise_session(&tx, session, true)?;
                stats.exercise_sessions_imported += 1;
            }
            for esp in &data.exercise_session_phrases {
                insert_exercise_session_phrase(&tx, esp, true, esp.session_id)?;
            }
        }
        ImportMode::Merge => {
            for setting in &data.settings {
                import_setting(&tx, setting, true)?;
                stats.settings_imported += 1;
            }

            let mut phrase_id_map: HashMap<i64, i64> = HashMap::new();
            let mut material_id_map: HashMap<i64, i64> = HashMap::new();

            for material in &data.materials {
                let existing: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM materials WHERE created_at = ?1 AND title = ?2",
                        params![material.created_at, material.title],
                        |row| row.get(0),
                    )
                    .ok();

                if let Some(existing_id) = existing {
                    material_id_map.insert(material.id, existing_id);
                } else {
                    let new_id = insert_material(&tx, material, false)?;
                    material_id_map.insert(material.id, new_id);
                    stats.materials_imported += 1;
                }
            }

            for phrase in &data.phrases {
                let mapped_material_id = phrase
                    .material_id
                    .and_then(|mid| material_id_map.get(&mid).copied());

                let existing: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM phrases WHERE created_at = ?1 AND prompt = ?2 AND answer = ?3",
                        params![phrase.created_at, phrase.prompt, phrase.answer],
                        |row| row.get(0),
                    )
                    .ok();

                if let Some(existing_id) = existing {
                    phrase_id_map.insert(phrase.id, existing_id);
                } else {
                    let new_id = insert_phrase(&tx, phrase, false, mapped_material_id)?;
                    phrase_id_map.insert(phrase.id, new_id);
                    stats.phrases_imported += 1;
                }
            }

            for thread in &data.phrase_threads {
                if let Some(&new_phrase_id) = phrase_id_map.get(&thread.phrase_id) {
                    insert_phrase_thread(&tx, thread, false, new_phrase_id)?;
                    stats.phrase_threads_imported += 1;
                }
            }

            // Practice sessions: dedup by (material_id, created_at)
            for session in &data.practice_sessions {
                if let Some(&new_material_id) = material_id_map.get(&session.material_id) {
                    let existing: Option<i64> = tx
                        .query_row(
                            "SELECT id FROM practice_sessions WHERE material_id = ?1 AND created_at = ?2",
                            params![new_material_id, session.created_at],
                            |row| row.get(0),
                        )
                        .ok();
                    if existing.is_none() {
                        insert_practice_session(&tx, session, false, new_material_id)?;
                        stats.practice_sessions_imported += 1;
                    }
                }
            }

            // Tags: dedup by (name, target_language). Build id map.
            let mut tag_id_map: HashMap<i64, i64> = HashMap::new();
            for tag in &data.tags {
                let existing: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM tags WHERE name = ?1 AND target_language = ?2",
                        params![tag.name, tag.target_language],
                        |row| row.get(0),
                    )
                    .ok();
                if let Some(existing_id) = existing {
                    tag_id_map.insert(tag.id, existing_id);
                } else {
                    let new_id = insert_tag(&tx, tag, false)?;
                    tag_id_map.insert(tag.id, new_id);
                    stats.tags_imported += 1;
                }
            }

            // Phrase-tag associations using both id maps
            for pt in &data.phrase_tags {
                if let (Some(&new_phrase_id), Some(&new_tag_id)) =
                    (phrase_id_map.get(&pt.phrase_id), tag_id_map.get(&pt.tag_id))
                {
                    let res = tx.execute(
                        "INSERT OR IGNORE INTO phrase_tags (phrase_id, tag_id) VALUES (?1, ?2)",
                        params![new_phrase_id, new_tag_id],
                    );
                    if let Ok(rows) = res {
                        if rows > 0 {
                            stats.phrase_tags_imported += 1;
                        }
                    }
                }
            }

            // Exercise sessions: dedup by (date, target_language, created_at). Map ids.
            let mut session_id_map: HashMap<i64, i64> = HashMap::new();
            for session in &data.exercise_sessions {
                let existing: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM exercise_sessions
                         WHERE date = ?1 AND target_language = ?2 AND created_at = ?3",
                        params![session.date, session.target_language, session.created_at],
                        |row| row.get(0),
                    )
                    .ok();
                if let Some(existing_id) = existing {
                    session_id_map.insert(session.id, existing_id);
                } else {
                    let new_id = insert_exercise_session(&tx, session, false)?;
                    session_id_map.insert(session.id, new_id);
                    stats.exercise_sessions_imported += 1;
                }
            }
            for esp in &data.exercise_session_phrases {
                if let Some(&new_session_id) = session_id_map.get(&esp.session_id) {
                    // Skip if there are already phrases for this session (avoid duplicates on re-import)
                    let count: i64 = tx
                        .query_row(
                            "SELECT COUNT(*) FROM exercise_session_phrases WHERE session_id = ?1",
                            params![new_session_id],
                            |row| row.get(0),
                        )
                        .unwrap_or(0);
                    if count == 0 {
                        insert_exercise_session_phrase(&tx, esp, false, new_session_id)?;
                    }
                }
            }

            for thread in &data.material_threads {
                if let Some(&new_material_id) = material_id_map.get(&thread.material_id) {
                    let existing: Option<i64> = tx
                        .query_row(
                            "SELECT id FROM material_threads WHERE material_id = ?1 AND segment_index = ?2",
                            params![new_material_id, thread.segment_index],
                            |row| row.get(0),
                        )
                        .ok();

                    if existing.is_none() {
                        insert_material_thread(&tx, thread, false, new_material_id)?;
                        stats.material_threads_imported += 1;
                    }
                }
            }
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(ImportResult {
        success: true,
        message: format!("Import completed successfully (mode: {:?})", mode),
        stats,
    })
}

// ── Private helpers ───────────────────────────────────────────────────────────

fn import_setting(
    tx: &rusqlite::Transaction,
    setting: &ExportSetting,
    replace: bool,
) -> Result<(), String> {
    let sql = if replace {
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)"
    } else {
        "INSERT INTO settings (key, value) VALUES (?1, ?2)"
    };
    tx.execute(sql, params![setting.key, setting.value])
        .map_err(|e| format!("Failed to import setting: {}", e))?;
    Ok(())
}

/// Insert a material row. When `with_id` is true, preserves original `id` (Overwrite mode).
/// Returns the rowid of the inserted row.
fn insert_material(
    tx: &rusqlite::Transaction,
    material: &ExportMaterial,
    with_id: bool,
) -> Result<i64, String> {
    if with_id {
        tx.execute(
            "INSERT INTO materials (id, title, material_type, source_url, original_text,
                                   segments_json, target_language, native_language, status,
                                   created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                material.id,
                material.title,
                material.material_type,
                material.source_url,
                material.original_text,
                material.segments_json,
                material.target_language,
                material.native_language,
                material.status,
                material.created_at,
                material.updated_at
            ],
        )
        .map_err(|e| format!("Failed to import material: {}", e))?;
    } else {
        tx.execute(
            "INSERT INTO materials (title, material_type, source_url, original_text,
                                   segments_json, target_language, native_language, status,
                                   created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                material.title,
                material.material_type,
                material.source_url,
                material.original_text,
                material.segments_json,
                material.target_language,
                material.native_language,
                material.status,
                material.created_at,
                material.updated_at
            ],
        )
        .map_err(|e| format!("Failed to import material: {}", e))?;
    }
    Ok(tx.last_insert_rowid())
}

/// Insert a phrase row. When `with_id` is true, preserves original `id` (Overwrite mode).
/// Returns the rowid of the inserted row.
fn insert_phrase(
    tx: &rusqlite::Transaction,
    phrase: &ExportPhrase,
    with_id: bool,
    mapped_material_id: Option<i64>,
) -> Result<i64, String> {
    let material_id = if with_id {
        phrase.material_id
    } else {
        mapped_material_id
    };
    if with_id {
        tx.execute(
            "INSERT INTO phrases (id, prompt, answer, accepted_json,
                                 target_language, native_language, audio_path, notes,
                                 starred, created_at, material_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                phrase.id,
                phrase.prompt,
                phrase.answer,
                phrase.accepted_json,
                phrase.target_language,
                phrase.native_language,
                phrase.audio_path,
                phrase.notes,
                phrase.starred as i32,
                phrase.created_at,
                material_id
            ],
        )
        .map_err(|e| format!("Failed to import phrase: {}", e))?;
    } else {
        tx.execute(
            "INSERT INTO phrases (prompt, answer, accepted_json,
                                 target_language, native_language, audio_path, notes,
                                 starred, created_at, material_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                phrase.prompt,
                phrase.answer,
                phrase.accepted_json,
                phrase.target_language,
                phrase.native_language,
                phrase.audio_path,
                phrase.notes,
                phrase.starred as i32,
                phrase.created_at,
                material_id
            ],
        )
        .map_err(|e| format!("Failed to import phrase: {}", e))?;
    }
    Ok(tx.last_insert_rowid())
}

/// Insert a phrase_thread row. `phrase_id` is the (possibly remapped) phrase FK.
/// When `with_id` is true, preserves original `id` (Overwrite mode).
fn insert_phrase_thread(
    tx: &rusqlite::Transaction,
    thread: &ExportPhraseThread,
    with_id: bool,
    phrase_id: i64,
) -> Result<(), String> {
    if with_id {
        tx.execute(
            "INSERT INTO phrase_threads (id, phrase_id, messages_json, suggested_prompt,
                                        suggested_answer, suggested_accepted, status,
                                        created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                thread.id,
                phrase_id,
                thread.messages_json,
                thread.suggested_prompt,
                thread.suggested_answer,
                thread.suggested_accepted,
                thread.status,
                thread.created_at,
                thread.updated_at
            ],
        )
        .map_err(|e| format!("Failed to import phrase_thread: {}", e))?;
    } else {
        tx.execute(
            "INSERT INTO phrase_threads (phrase_id, messages_json, suggested_prompt,
                                        suggested_answer, suggested_accepted, status,
                                        created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                phrase_id,
                thread.messages_json,
                thread.suggested_prompt,
                thread.suggested_answer,
                thread.suggested_accepted,
                thread.status,
                thread.created_at,
                thread.updated_at
            ],
        )
        .map_err(|e| format!("Failed to import phrase_thread: {}", e))?;
    }
    Ok(())
}

fn insert_practice_session(
    tx: &rusqlite::Transaction,
    session: &ExportPracticeSession,
    with_id: bool,
    material_id: i64,
) -> Result<(), String> {
    if with_id {
        tx.execute(
            "INSERT INTO practice_sessions (id, material_id, mode, messages_json,
                                           suggested_phrases_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                session.id,
                material_id,
                session.mode,
                session.messages_json,
                session.suggested_phrases_json,
                session.created_at,
                session.updated_at
            ],
        )
        .map_err(|e| format!("Failed to import practice_session: {}", e))?;
    } else {
        tx.execute(
            "INSERT INTO practice_sessions (material_id, mode, messages_json,
                                           suggested_phrases_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                material_id,
                session.mode,
                session.messages_json,
                session.suggested_phrases_json,
                session.created_at,
                session.updated_at
            ],
        )
        .map_err(|e| format!("Failed to import practice_session: {}", e))?;
    }
    Ok(())
}

fn insert_tag(tx: &rusqlite::Transaction, tag: &ExportTag, with_id: bool) -> Result<i64, String> {
    if with_id {
        tx.execute(
            "INSERT INTO tags (id, name, target_language, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![tag.id, tag.name, tag.target_language, tag.created_at],
        )
        .map_err(|e| format!("Failed to import tag: {}", e))?;
    } else {
        tx.execute(
            "INSERT INTO tags (name, target_language, created_at) VALUES (?1, ?2, ?3)",
            params![tag.name, tag.target_language, tag.created_at],
        )
        .map_err(|e| format!("Failed to import tag: {}", e))?;
    }
    Ok(tx.last_insert_rowid())
}

fn insert_exercise_session(
    tx: &rusqlite::Transaction,
    session: &ExportExerciseSession,
    with_id: bool,
) -> Result<i64, String> {
    if with_id {
        tx.execute(
            "INSERT INTO exercise_sessions (id, date, phrases_completed, phrases_total,
                                           target_language, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                session.id,
                session.date,
                session.phrases_completed,
                session.phrases_total,
                session.target_language,
                session.created_at
            ],
        )
        .map_err(|e| format!("Failed to import exercise_session: {}", e))?;
    } else {
        tx.execute(
            "INSERT INTO exercise_sessions (date, phrases_completed, phrases_total,
                                           target_language, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                session.date,
                session.phrases_completed,
                session.phrases_total,
                session.target_language,
                session.created_at
            ],
        )
        .map_err(|e| format!("Failed to import exercise_session: {}", e))?;
    }
    Ok(tx.last_insert_rowid())
}

fn insert_exercise_session_phrase(
    tx: &rusqlite::Transaction,
    esp: &ExportExerciseSessionPhrase,
    with_id: bool,
    session_id: i64,
) -> Result<(), String> {
    if with_id {
        tx.execute(
            "INSERT INTO exercise_session_phrases (id, session_id, prompt, answer,
                                                   attempts, completed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                esp.id,
                session_id,
                esp.prompt,
                esp.answer,
                esp.attempts,
                esp.completed
            ],
        )
        .map_err(|e| format!("Failed to import exercise_session_phrase: {}", e))?;
    } else {
        tx.execute(
            "INSERT INTO exercise_session_phrases (session_id, prompt, answer, attempts, completed)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                session_id,
                esp.prompt,
                esp.answer,
                esp.attempts,
                esp.completed
            ],
        )
        .map_err(|e| format!("Failed to import exercise_session_phrase: {}", e))?;
    }
    Ok(())
}

/// Insert a material_thread row. `material_id` is the (possibly remapped) material FK.
/// When `with_id` is true, preserves original `id` (Overwrite mode).
fn insert_material_thread(
    tx: &rusqlite::Transaction,
    thread: &ExportMaterialThread,
    with_id: bool,
    material_id: i64,
) -> Result<(), String> {
    if with_id {
        tx.execute(
            "INSERT INTO material_threads (id, material_id, segment_index, messages_json,
                                          suggested_phrases_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                thread.id,
                material_id,
                thread.segment_index,
                thread.messages_json,
                thread.suggested_phrases_json,
                thread.created_at,
                thread.updated_at
            ],
        )
        .map_err(|e| format!("Failed to import material_thread: {}", e))?;
    } else {
        tx.execute(
            "INSERT INTO material_threads (material_id, segment_index, messages_json,
                                          suggested_phrases_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                material_id,
                thread.segment_index,
                thread.messages_json,
                thread.suggested_phrases_json,
                thread.created_at,
                thread.updated_at
            ],
        )
        .map_err(|e| format!("Failed to import material_thread: {}", e))?;
    }
    Ok(())
}
