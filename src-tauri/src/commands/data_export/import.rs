use crate::db::get_conn;
use crate::models::{
    ExportData, ExportMaterial, ExportMaterialThread, ExportPhrase, ExportPhraseThread,
    ExportSetting, ImportMode, ImportResult, ImportStats,
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
    if data.version > 4 {
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
