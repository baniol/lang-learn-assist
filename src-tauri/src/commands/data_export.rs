use crate::db::get_conn;
use crate::models::{
    ExportData, ExportMaterial, ExportMaterialThread, ExportPhrase, ExportPhraseThread,
    ExportSetting, ImportMode, ImportResult, ImportStats,
};
use rusqlite::{params, Connection};
use std::collections::HashMap;

#[tauri::command]
pub fn export_data() -> Result<ExportData, String> {
    let conn = get_conn()?;
    export_data_with_conn(&conn)
}

/// Core export logic that can be tested with any connection
pub fn export_data_with_conn(conn: &Connection) -> Result<ExportData, String> {
    // Export settings
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| format!("Failed to prepare settings query: {}", e))?;
    let settings = stmt
        .query_map([], |row| {
            Ok(ExportSetting {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query settings: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect settings: {}", e))?;
    drop(stmt);

    // Export phrases
    let mut stmt = conn
        .prepare(
            "SELECT id, prompt, answer, accepted_json, target_language,
                    native_language, audio_path, notes, starred, created_at, material_id
             FROM phrases",
        )
        .map_err(|e| format!("Failed to prepare phrases query: {}", e))?;
    let phrases = stmt
        .query_map([], |row| {
            let starred_int: i32 = row.get(8)?;
            Ok(ExportPhrase {
                id: row.get(0)?,
                conversation_id: None,
                material_id: row.get(10).ok(),
                deck_id: None,
                prompt: row.get(1)?,
                answer: row.get(2)?,
                accepted_json: row.get(3)?,
                target_language: row.get(4)?,
                native_language: row.get(5)?,
                audio_path: row.get(6)?,
                notes: row.get(7)?,
                starred: starred_int != 0,
                excluded: None,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to query phrases: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect phrases: {}", e))?;
    drop(stmt);

    // Export phrase threads
    let mut stmt = conn
        .prepare(
            "SELECT id, phrase_id, messages_json, suggested_prompt, suggested_answer,
                    suggested_accepted, status, created_at, updated_at
             FROM phrase_threads",
        )
        .map_err(|e| format!("Failed to prepare phrase_threads query: {}", e))?;
    let phrase_threads = stmt
        .query_map([], |row| {
            Ok(ExportPhraseThread {
                id: row.get(0)?,
                phrase_id: row.get(1)?,
                messages_json: row.get(2)?,
                suggested_prompt: row.get(3)?,
                suggested_answer: row.get(4)?,
                suggested_accepted: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query phrase_threads: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect phrase_threads: {}", e))?;
    drop(stmt);

    // Export materials
    let mut stmt = conn
        .prepare(
            "SELECT id, title, material_type, source_url, original_text, segments_json,
                    target_language, native_language, status, created_at, updated_at
             FROM materials",
        )
        .map_err(|e| format!("Failed to prepare materials query: {}", e))?;
    let materials = stmt
        .query_map([], |row| {
            Ok(ExportMaterial {
                id: row.get(0)?,
                title: row.get(1)?,
                material_type: row.get(2)?,
                source_url: row.get(3)?,
                original_text: row.get(4)?,
                segments_json: row.get(5)?,
                target_language: row.get(6)?,
                native_language: row.get(7)?,
                status: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("Failed to query materials: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect materials: {}", e))?;
    drop(stmt);

    // Export material threads
    let mut stmt = conn
        .prepare(
            "SELECT id, material_id, segment_index, messages_json, suggested_phrases_json,
                    created_at, updated_at
             FROM material_threads",
        )
        .map_err(|e| format!("Failed to prepare material_threads query: {}", e))?;
    let material_threads = stmt
        .query_map([], |row| {
            Ok(ExportMaterialThread {
                id: row.get(0)?,
                material_id: row.get(1)?,
                segment_index: row.get(2)?,
                messages_json: row.get(3)?,
                suggested_phrases_json: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to query material_threads: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect material_threads: {}", e))?;
    drop(stmt);

    Ok(ExportData {
        version: 4,
        exported_at: chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        settings,
        phrases,
        phrase_threads,
        question_threads: vec![],
        notes: vec![],
        materials,
        material_threads,
        phrase_progress: vec![],
        practice_sessions: vec![],
        decks: vec![],
    })
}

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
    // Check version compatibility
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
            // Delete all existing data in reverse FK order
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
            // Materials must come before phrases (FK constraint)
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

            // Build ID mappings for FK relationships
            let mut phrase_id_map: HashMap<i64, i64> = HashMap::new();
            let mut material_id_map: HashMap<i64, i64> = HashMap::new();

            // Materials must come before phrases (FK constraint)
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

// ── Private import helpers ────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

/// Result of finding duplicate phrases
#[derive(Debug, Clone, serde::Serialize)]
pub struct DuplicateInfo {
    /// The answer text (target language phrase)
    pub answer: String,
    /// Target language
    pub target_language: String,
    /// IDs of duplicate phrases (all except the one to keep)
    pub duplicate_ids: Vec<i64>,
    /// ID of the phrase to keep (the one with earliest created)
    pub keep_id: i64,
}

/// Result of duplicate removal
#[derive(Debug, Clone, serde::Serialize)]
pub struct RemoveDuplicatesResult {
    pub duplicates_found: i32,
    pub phrases_removed: i32,
    pub details: Vec<DuplicateInfo>,
}

/// Find duplicate phrases based on answer + target_language
/// Returns info about duplicates without removing them
#[tauri::command]
pub fn find_duplicate_phrases() -> Result<RemoveDuplicatesResult, String> {
    let conn = get_conn()?;

    // Find phrases that have duplicates (same answer + target_language)
    let mut stmt = conn
        .prepare(
            "SELECT answer, target_language, COUNT(*) as cnt
             FROM phrases
             GROUP BY answer, target_language
             HAVING cnt > 1",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let duplicates: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query duplicates: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect: {}", e))?;

    let mut details = Vec::new();

    for (answer, target_language) in duplicates {
        // Get all phrase IDs with this answer, ordered by created_at
        let mut stmt = conn
            .prepare(
                "SELECT p.id
                 FROM phrases p
                 WHERE p.answer = ?1 AND p.target_language = ?2
                 ORDER BY p.created_at ASC",
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let ids: Vec<i64> = stmt
            .query_map(params![answer, target_language], |row| row.get(0))
            .map_err(|e| format!("Failed to query phrase ids: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect ids: {}", e))?;

        if ids.len() > 1 {
            let keep_id = ids[0];
            let duplicate_ids: Vec<i64> = ids[1..].to_vec();

            details.push(DuplicateInfo {
                answer: answer.clone(),
                target_language: target_language.clone(),
                duplicate_ids,
                keep_id,
            });
        }
    }

    Ok(RemoveDuplicatesResult {
        duplicates_found: details.len() as i32,
        phrases_removed: 0, // Not removed yet, just found
        details,
    })
}

/// Remove duplicate phrases, keeping the one with earliest creation date
#[tauri::command]
pub fn remove_duplicate_phrases() -> Result<RemoveDuplicatesResult, String> {
    let mut conn = get_conn()?;

    // First find all duplicates
    let found = find_duplicate_phrases()?;

    if found.details.is_empty() {
        return Ok(RemoveDuplicatesResult {
            duplicates_found: 0,
            phrases_removed: 0,
            details: vec![],
        });
    }

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let mut total_removed = 0;

    for dup in &found.details {
        for id in &dup.duplicate_ids {
            // Delete phrase (cascade will handle related records)
            tx.execute("DELETE FROM phrases WHERE id = ?1", params![id])
                .map_err(|e| format!("Failed to delete phrase: {}", e))?;

            total_removed += 1;
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit: {}", e))?;

    Ok(RemoveDuplicatesResult {
        duplicates_found: found.details.len() as i32,
        phrases_removed: total_removed,
        details: found.details,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;

    /// Create an in-memory database with schema initialized
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory database");
        init_db(&conn).expect("Failed to initialize database schema");
        conn
    }

    /// Create minimal test export data
    fn create_test_export_data() -> ExportData {
        ExportData {
            version: 4,
            exported_at: "2024-01-01T00:00:00Z".to_string(),
            settings: vec![ExportSetting {
                key: "test_key".to_string(),
                value: "test_value".to_string(),
            }],
            phrases: vec![ExportPhrase {
                id: 1,
                conversation_id: None,
                material_id: None,
                deck_id: None,
                prompt: "Hello".to_string(),
                answer: "Hallo".to_string(),
                accepted_json: "[]".to_string(),
                target_language: "de".to_string(),
                native_language: "en".to_string(),
                audio_path: None,
                notes: None,
                starred: false,
                excluded: None,
                created_at: "2024-01-01T00:00:00Z".to_string(),
            }],
            phrase_threads: vec![],
            question_threads: vec![],
            notes: vec![],
            materials: vec![],
            material_threads: vec![],
            phrase_progress: vec![],
            practice_sessions: vec![],
            decks: vec![],
        }
    }

    #[test]
    fn test_export_empty_database() {
        let conn = setup_test_db();
        let result = export_data_with_conn(&conn);
        assert!(result.is_ok());

        let data = result.unwrap();
        assert_eq!(data.version, 4);
        assert!(data.settings.is_empty());
        assert!(data.phrases.is_empty());
    }

    #[test]
    fn test_import_overwrite_mode() {
        let mut conn = setup_test_db();

        let test_data = create_test_export_data();
        let result = import_data_with_conn(&mut conn, test_data, ImportMode::Overwrite);

        assert!(result.is_ok());
        let import_result = result.unwrap();
        assert!(import_result.success);
        assert_eq!(import_result.stats.settings_imported, 1);
        assert_eq!(import_result.stats.phrases_imported, 1);
    }

    #[test]
    fn test_import_then_export_roundtrip() {
        let mut conn = setup_test_db();

        // Import test data
        let original_data = create_test_export_data();
        import_data_with_conn(&mut conn, original_data.clone(), ImportMode::Overwrite)
            .expect("Import failed");

        // Export and verify
        let exported = export_data_with_conn(&conn).expect("Export failed");

        assert_eq!(exported.settings.len(), 1);
        assert_eq!(exported.settings[0].key, "test_key");
        assert_eq!(exported.phrases.len(), 1);
        assert_eq!(exported.phrases[0].prompt, "Hello");
        assert_eq!(exported.phrases[0].answer, "Hallo");
    }

    #[test]
    fn test_import_merge_mode_adds_new() {
        let mut conn = setup_test_db();

        // First import
        let data1 = create_test_export_data();
        import_data_with_conn(&mut conn, data1, ImportMode::Overwrite)
            .expect("First import failed");

        // Second import with different data
        let mut data2 = create_test_export_data();
        data2.phrases[0].id = 2;
        data2.phrases[0].prompt = "Goodbye".to_string();
        data2.phrases[0].answer = "Tschüss".to_string();
        data2.phrases[0].created_at = "2024-01-02T00:00:00Z".to_string();
        let result = import_data_with_conn(&mut conn, data2, ImportMode::Merge);
        assert!(result.is_ok());

        // Verify both sets of data exist
        let exported = export_data_with_conn(&conn).expect("Export failed");
        assert_eq!(exported.phrases.len(), 2);
    }

    #[test]
    fn test_import_merge_mode_skips_duplicates() {
        let mut conn = setup_test_db();

        // First import
        let data = create_test_export_data();
        import_data_with_conn(&mut conn, data.clone(), ImportMode::Overwrite)
            .expect("First import failed");

        // Same data again in merge mode
        let result = import_data_with_conn(&mut conn, data.clone(), ImportMode::Merge);
        assert!(result.is_ok());
        let import_result = result.unwrap();

        // Should not create duplicates
        assert_eq!(import_result.stats.phrases_imported, 0);
        // Verify no duplicates
        let exported = export_data_with_conn(&conn).expect("Export failed");
        assert_eq!(exported.phrases.len(), 1);
    }

    #[test]
    fn test_import_rejects_future_version() {
        let mut conn = setup_test_db();

        let mut data = create_test_export_data();
        data.version = 99;

        let result = import_data_with_conn(&mut conn, data, ImportMode::Overwrite);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not supported"));
    }

    #[test]
    fn test_export_includes_all_phrase_fields() {
        let conn = setup_test_db();

        // Insert a phrase with all fields populated
        conn.execute(
            "INSERT INTO phrases (id, prompt, answer, accepted_json,
                                  target_language, native_language, audio_path, notes,
                                  starred, created_at)
             VALUES (1, 'Hello', 'Hallo', '[\"Hi\"]', 'de', 'en', '/path/to/audio.mp3',
                     'A greeting', 1, '2024-01-01')",
            [],
        )
        .unwrap();

        let exported = export_data_with_conn(&conn).expect("Export failed");
        let phrase = &exported.phrases[0];

        assert_eq!(phrase.prompt, "Hello");
        assert_eq!(phrase.answer, "Hallo");
        assert_eq!(phrase.accepted_json, "[\"Hi\"]");
        assert_eq!(phrase.audio_path, Some("/path/to/audio.mp3".to_string()));
        assert_eq!(phrase.notes, Some("A greeting".to_string()));
        assert!(phrase.starred);
    }
}
