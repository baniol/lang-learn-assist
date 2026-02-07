use crate::db::get_conn;
use crate::models::{
    ExportData, ExportDeck, ExportMaterial, ExportMaterialThread, ExportNote,
    ExportPhrase, ExportPhraseProgress, ExportPhraseThread, ExportPracticeSession,
    ExportQuestionThread, ExportSetting, ImportMode, ImportResult, ImportStats,
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
            "SELECT id, conversation_id, prompt, answer, accepted_json, target_language,
                    native_language, audio_path, notes, starred, excluded, created_at, material_id, deck_id
             FROM phrases",
        )
        .map_err(|e| format!("Failed to prepare phrases query: {}", e))?;
    let phrases = stmt
        .query_map([], |row| {
            let starred_int: i32 = row.get(9)?;
            let excluded_int: i32 = row.get(10).unwrap_or(0);
            Ok(ExportPhrase {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                material_id: row.get(12).ok(),
                deck_id: row.get(13).ok(),
                prompt: row.get(2)?,
                answer: row.get(3)?,
                accepted_json: row.get(4)?,
                target_language: row.get(5)?,
                native_language: row.get(6)?,
                audio_path: row.get(7)?,
                notes: row.get(8)?,
                starred: starred_int != 0,
                excluded: excluded_int != 0,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| format!("Failed to query phrases: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect phrases: {}", e))?;
    drop(stmt);

    // Export phrase progress
    let mut stmt = conn
        .prepare(
            "SELECT id, phrase_id, correct_streak, total_attempts, success_count,
                    last_seen, ease_factor, interval_days, next_review_at, in_srs_pool, deck_correct_count, learning_status
             FROM phrase_progress",
        )
        .map_err(|e| format!("Failed to prepare phrase_progress query: {}", e))?;
    let phrase_progress = stmt
        .query_map([], |row| {
            let in_srs_pool_int: i32 = row.get(9).unwrap_or(1);
            let learning_status: String = row.get(11).unwrap_or_else(|_| "inactive".to_string());
            Ok(ExportPhraseProgress {
                id: row.get(0)?,
                phrase_id: row.get(1)?,
                correct_streak: row.get(2)?,
                total_attempts: row.get(3)?,
                success_count: row.get(4)?,
                last_seen: row.get(5)?,
                ease_factor: row.get(6).unwrap_or(2.5),
                interval_days: row.get(7).unwrap_or(1),
                next_review_at: row.get(8).ok(),
                in_srs_pool: in_srs_pool_int != 0,
                deck_correct_count: row.get(10).unwrap_or(0),
                learning_status,
            })
        })
        .map_err(|e| format!("Failed to query phrase_progress: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect phrase_progress: {}", e))?;
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

    // Export question threads
    let mut stmt = conn
        .prepare(
            "SELECT id, title, target_language, native_language, messages_json,
                    created_at, updated_at
             FROM question_threads",
        )
        .map_err(|e| format!("Failed to prepare question_threads query: {}", e))?;
    let question_threads = stmt
        .query_map([], |row| {
            Ok(ExportQuestionThread {
                id: row.get(0)?,
                title: row.get(1)?,
                target_language: row.get(2)?,
                native_language: row.get(3)?,
                messages_json: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to query question_threads: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect question_threads: {}", e))?;
    drop(stmt);

    // Export notes
    let mut stmt = conn
        .prepare("SELECT id, content, created_at, updated_at FROM notes")
        .map_err(|e| format!("Failed to prepare notes query: {}", e))?;
    let notes = stmt
        .query_map([], |row| {
            Ok(ExportNote {
                id: row.get(0)?,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query notes: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect notes: {}", e))?;
    drop(stmt);

    // Export practice sessions
    let mut stmt = conn
        .prepare(
            "SELECT id, started_at, finished_at, total_phrases, correct_answers,
                    exercise_mode, state_json
             FROM practice_sessions",
        )
        .map_err(|e| format!("Failed to prepare practice_sessions query: {}", e))?;
    let practice_sessions = stmt
        .query_map([], |row| {
            Ok(ExportPracticeSession {
                id: row.get(0)?,
                started_at: row.get(1)?,
                finished_at: row.get(2)?,
                total_phrases: row.get(3)?,
                correct_answers: row.get(4)?,
                exercise_mode: row.get(5)?,
                state_json: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to query practice_sessions: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect practice_sessions: {}", e))?;
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

    // Export decks
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, target_language, native_language, graduation_threshold, created_at, updated_at, level, category
             FROM decks",
        )
        .map_err(|e| format!("Failed to prepare decks query: {}", e))?;
    let decks = stmt
        .query_map([], |row| {
            Ok(ExportDeck {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                target_language: row.get(3)?,
                native_language: row.get(4)?,
                graduation_threshold: row.get(5)?,
                level: row.get(8)?,
                category: row.get(9)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to query decks: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect decks: {}", e))?;
    drop(stmt);

    Ok(ExportData {
        version: 3,
        exported_at: chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        settings,
        phrases,
        phrase_progress,
        phrase_threads,
        question_threads,
        notes,
        practice_sessions,
        materials,
        material_threads,
        decks,
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
    if data.version > 3 {
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
            tx.execute("DELETE FROM practice_sessions", [])
                .map_err(|e| format!("Failed to delete practice_sessions: {}", e))?;
            tx.execute("DELETE FROM notes", [])
                .map_err(|e| format!("Failed to delete notes: {}", e))?;
            tx.execute("DELETE FROM question_threads", [])
                .map_err(|e| format!("Failed to delete question_threads: {}", e))?;
            tx.execute("DELETE FROM phrase_threads", [])
                .map_err(|e| format!("Failed to delete phrase_threads: {}", e))?;
            tx.execute("DELETE FROM phrase_progress", [])
                .map_err(|e| format!("Failed to delete phrase_progress: {}", e))?;
            tx.execute("DELETE FROM material_threads", [])
                .map_err(|e| format!("Failed to delete material_threads: {}", e))?;
            tx.execute("DELETE FROM phrases", [])
                .map_err(|e| format!("Failed to delete phrases: {}", e))?;
            tx.execute("DELETE FROM decks", [])
                .map_err(|e| format!("Failed to delete decks: {}", e))?;
            tx.execute("DELETE FROM materials", [])
                .map_err(|e| format!("Failed to delete materials: {}", e))?;
            tx.execute("DELETE FROM settings", [])
                .map_err(|e| format!("Failed to delete settings: {}", e))?;

            // Import settings
            for setting in &data.settings {
                tx.execute(
                    "INSERT INTO settings (key, value) VALUES (?1, ?2)",
                    params![setting.key, setting.value],
                )
                .map_err(|e| format!("Failed to import setting: {}", e))?;
                stats.settings_imported += 1;
            }

            // Import decks with original IDs
            for deck in &data.decks {
                tx.execute(
                    "INSERT INTO decks (id, name, description, target_language, native_language,
                                       graduation_threshold, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        deck.id,
                        deck.name,
                        deck.description,
                        deck.target_language,
                        deck.native_language,
                        deck.graduation_threshold,
                        deck.created_at,
                        deck.updated_at
                    ],
                )
                .map_err(|e| format!("Failed to import deck: {}", e))?;
                stats.decks_imported += 1;
            }

            // Import phrases with original IDs
            for phrase in &data.phrases {
                tx.execute(
                    "INSERT INTO phrases (id, conversation_id, prompt, answer, accepted_json,
                                         target_language, native_language, audio_path, notes,
                                         starred, excluded, created_at, material_id, deck_id)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                    params![
                        phrase.id,
                        phrase.conversation_id,
                        phrase.prompt,
                        phrase.answer,
                        phrase.accepted_json,
                        phrase.target_language,
                        phrase.native_language,
                        phrase.audio_path,
                        phrase.notes,
                        phrase.starred as i32,
                        phrase.excluded as i32,
                        phrase.created_at,
                        phrase.material_id,
                        phrase.deck_id
                    ],
                )
                .map_err(|e| format!("Failed to import phrase: {}", e))?;
                stats.phrases_imported += 1;
            }

            // Import phrase progress with original IDs
            for progress in &data.phrase_progress {
                tx.execute(
                    "INSERT INTO phrase_progress (id, phrase_id, correct_streak, total_attempts,
                                                 success_count, last_seen, ease_factor,
                                                 interval_days, next_review_at, in_srs_pool, deck_correct_count, learning_status)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                    params![
                        progress.id,
                        progress.phrase_id,
                        progress.correct_streak,
                        progress.total_attempts,
                        progress.success_count,
                        progress.last_seen,
                        progress.ease_factor,
                        progress.interval_days,
                        progress.next_review_at,
                        progress.in_srs_pool as i32,
                        progress.deck_correct_count,
                        progress.learning_status
                    ],
                )
                .map_err(|e| format!("Failed to import phrase_progress: {}", e))?;
                stats.phrase_progress_imported += 1;
            }

            // Import phrase threads with original IDs
            for thread in &data.phrase_threads {
                tx.execute(
                    "INSERT INTO phrase_threads (id, phrase_id, messages_json, suggested_prompt,
                                                suggested_answer, suggested_accepted, status,
                                                created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        thread.id,
                        thread.phrase_id,
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
                stats.phrase_threads_imported += 1;
            }

            // Import question threads with original IDs
            for thread in &data.question_threads {
                tx.execute(
                    "INSERT INTO question_threads (id, title, target_language, native_language,
                                                  messages_json, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        thread.id,
                        thread.title,
                        thread.target_language,
                        thread.native_language,
                        thread.messages_json,
                        thread.created_at,
                        thread.updated_at
                    ],
                )
                .map_err(|e| format!("Failed to import question_thread: {}", e))?;
                stats.question_threads_imported += 1;
            }

            // Import notes with original IDs
            for note in &data.notes {
                tx.execute(
                    "INSERT INTO notes (id, content, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![note.id, note.content, note.created_at, note.updated_at],
                )
                .map_err(|e| format!("Failed to import note: {}", e))?;
                stats.notes_imported += 1;
            }

            // Import practice sessions with original IDs
            for session in &data.practice_sessions {
                tx.execute(
                    "INSERT INTO practice_sessions (id, started_at, finished_at, total_phrases,
                                                   correct_answers, exercise_mode, state_json)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        session.id,
                        session.started_at,
                        session.finished_at,
                        session.total_phrases,
                        session.correct_answers,
                        session.exercise_mode,
                        session.state_json
                    ],
                )
                .map_err(|e| format!("Failed to import practice_session: {}", e))?;
                stats.practice_sessions_imported += 1;
            }

            // Import materials with original IDs
            for material in &data.materials {
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
                stats.materials_imported += 1;
            }

            // Import material threads with original IDs
            for thread in &data.material_threads {
                tx.execute(
                    "INSERT INTO material_threads (id, material_id, segment_index, messages_json,
                                                  suggested_phrases_json, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        thread.id,
                        thread.material_id,
                        thread.segment_index,
                        thread.messages_json,
                        thread.suggested_phrases_json,
                        thread.created_at,
                        thread.updated_at
                    ],
                )
                .map_err(|e| format!("Failed to import material_thread: {}", e))?;
                stats.material_threads_imported += 1;
            }
        }
        ImportMode::Merge => {
            // Import settings (overwrite existing keys)
            for setting in &data.settings {
                tx.execute(
                    "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                    params![setting.key, setting.value],
                )
                .map_err(|e| format!("Failed to import setting: {}", e))?;
                stats.settings_imported += 1;
            }

            // Build ID mappings for relationships
            let mut phrase_id_map: HashMap<i64, i64> = HashMap::new();
            let mut deck_id_map: HashMap<i64, i64> = HashMap::new();

            // Import decks (check by created_at + name for uniqueness)
            for deck in &data.decks {
                let existing: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM decks WHERE created_at = ?1 AND name = ?2",
                        params![deck.created_at, deck.name],
                        |row| row.get(0),
                    )
                    .ok();

                if let Some(existing_id) = existing {
                    deck_id_map.insert(deck.id, existing_id);
                } else {
                    tx.execute(
                        "INSERT INTO decks (name, description, target_language, native_language,
                                           graduation_threshold, created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![
                            deck.name,
                            deck.description,
                            deck.target_language,
                            deck.native_language,
                            deck.graduation_threshold,
                            deck.created_at,
                            deck.updated_at
                        ],
                    )
                    .map_err(|e| format!("Failed to import deck: {}", e))?;
                    let new_id = tx.last_insert_rowid();
                    deck_id_map.insert(deck.id, new_id);
                    stats.decks_imported += 1;
                }
            }

            // Import phrases (check by created_at + prompt + answer for uniqueness)
            for phrase in &data.phrases {
                let mapped_deck_id = phrase
                    .deck_id
                    .and_then(|did| deck_id_map.get(&did).copied());

                let existing: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM phrases WHERE created_at = ?1 AND prompt = ?2 AND answer = ?3",
                        params![phrase.created_at, phrase.prompt, phrase.answer],
                        |row| row.get(0),
                    )
                    .ok();

                if let Some(existing_id) = existing {
                    // Phrase exists, just map the ID
                    phrase_id_map.insert(phrase.id, existing_id);
                    // Could update here if we track updated_at for phrases
                } else {
                    tx.execute(
                        "INSERT INTO phrases (prompt, answer, accepted_json,
                                             target_language, native_language, audio_path, notes,
                                             starred, excluded, created_at, material_id, deck_id)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                        params![
                            phrase.prompt,
                            phrase.answer,
                            phrase.accepted_json,
                            phrase.target_language,
                            phrase.native_language,
                            phrase.audio_path,
                            phrase.notes,
                            phrase.starred as i32,
                            phrase.excluded as i32,
                            phrase.created_at,
                            phrase.material_id,
                            mapped_deck_id
                        ],
                    )
                    .map_err(|e| format!("Failed to import phrase: {}", e))?;
                    let new_id = tx.last_insert_rowid();
                    phrase_id_map.insert(phrase.id, new_id);
                    stats.phrases_imported += 1;
                }
            }

            // Import phrase progress (linked to phrases)
            for progress in &data.phrase_progress {
                if let Some(&new_phrase_id) = phrase_id_map.get(&progress.phrase_id) {
                    // Check if progress exists for this phrase
                    let existing: Option<i64> = tx
                        .query_row(
                            "SELECT id FROM phrase_progress WHERE phrase_id = ?1",
                            params![new_phrase_id],
                            |row| row.get(0),
                        )
                        .ok();

                    if existing.is_none() {
                        tx.execute(
                            "INSERT INTO phrase_progress (phrase_id, correct_streak, total_attempts,
                                                         success_count, last_seen, ease_factor,
                                                         interval_days, next_review_at, in_srs_pool, deck_correct_count, learning_status)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                            params![
                                new_phrase_id,
                                progress.correct_streak,
                                progress.total_attempts,
                                progress.success_count,
                                progress.last_seen,
                                progress.ease_factor,
                                progress.interval_days,
                                progress.next_review_at,
                                progress.in_srs_pool as i32,
                                progress.deck_correct_count,
                                progress.learning_status
                            ],
                        )
                        .map_err(|e| format!("Failed to import phrase_progress: {}", e))?;
                        stats.phrase_progress_imported += 1;
                    }
                }
            }

            // Import phrase threads (linked to phrases)
            for thread in &data.phrase_threads {
                if let Some(&new_phrase_id) = phrase_id_map.get(&thread.phrase_id) {
                    // Just insert new threads without checking for duplicates
                    tx.execute(
                        "INSERT INTO phrase_threads (phrase_id, messages_json, suggested_prompt,
                                                    suggested_answer, suggested_accepted, status,
                                                    created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                        params![
                            new_phrase_id,
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
                    stats.phrase_threads_imported += 1;
                }
            }

            // Import question threads (check by created_at + title)
            for thread in &data.question_threads {
                let existing: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM question_threads WHERE created_at = ?1 AND title = ?2",
                        params![thread.created_at, thread.title],
                        |row| row.get(0),
                    )
                    .ok();

                if existing.is_none() {
                    tx.execute(
                        "INSERT INTO question_threads (title, target_language, native_language,
                                                      messages_json, created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        params![
                            thread.title,
                            thread.target_language,
                            thread.native_language,
                            thread.messages_json,
                            thread.created_at,
                            thread.updated_at
                        ],
                    )
                    .map_err(|e| format!("Failed to import question_thread: {}", e))?;
                    stats.question_threads_imported += 1;
                }
            }

            // Import notes (check by created_at + content)
            for note in &data.notes {
                let existing: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM notes WHERE created_at = ?1 AND content = ?2",
                        params![note.created_at, note.content],
                        |row| row.get(0),
                    )
                    .ok();

                if existing.is_none() {
                    tx.execute(
                        "INSERT INTO notes (content, created_at, updated_at)
                         VALUES (?1, ?2, ?3)",
                        params![note.content, note.created_at, note.updated_at],
                    )
                    .map_err(|e| format!("Failed to import note: {}", e))?;
                    stats.notes_imported += 1;
                }
            }

            // Import practice sessions (check by started_at)
            for session in &data.practice_sessions {
                let existing: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM practice_sessions WHERE started_at = ?1",
                        params![session.started_at],
                        |row| row.get(0),
                    )
                    .ok();

                if existing.is_none() {
                    tx.execute(
                        "INSERT INTO practice_sessions (started_at, finished_at, total_phrases,
                                                       correct_answers, exercise_mode, state_json)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        params![
                            session.started_at,
                            session.finished_at,
                            session.total_phrases,
                            session.correct_answers,
                            session.exercise_mode,
                            session.state_json
                        ],
                    )
                    .map_err(|e| format!("Failed to import practice_session: {}", e))?;
                    stats.practice_sessions_imported += 1;
                }
            }

            // Build material ID mapping for relationships
            let mut material_id_map: HashMap<i64, i64> = HashMap::new();

            // Import materials (check by created_at + title)
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
                    let new_id = tx.last_insert_rowid();
                    material_id_map.insert(material.id, new_id);
                    stats.materials_imported += 1;
                }
            }

            // Import material threads (linked to materials)
            for thread in &data.material_threads {
                if let Some(&new_material_id) = material_id_map.get(&thread.material_id) {
                    // Check if thread exists for this material + segment
                    let existing: Option<i64> = tx
                        .query_row(
                            "SELECT id FROM material_threads WHERE material_id = ?1 AND segment_index = ?2",
                            params![new_material_id, thread.segment_index],
                            |row| row.get(0),
                        )
                        .ok();

                    if existing.is_none() {
                        tx.execute(
                            "INSERT INTO material_threads (material_id, segment_index, messages_json,
                                                          suggested_phrases_json, created_at, updated_at)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                            params![
                                new_material_id,
                                thread.segment_index,
                                thread.messages_json,
                                thread.suggested_phrases_json,
                                thread.created_at,
                                thread.updated_at
                            ],
                        )
                        .map_err(|e| format!("Failed to import material_thread: {}", e))?;
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
        message: format!(
            "Import completed successfully (mode: {:?})",
            mode
        ),
        stats,
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
            version: 3,
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
                excluded: false,
                created_at: "2024-01-01T00:00:00Z".to_string(),
            }],
            phrase_progress: vec![ExportPhraseProgress {
                id: 1,
                phrase_id: 1,
                correct_streak: 2,
                total_attempts: 5,
                success_count: 4,
                last_seen: Some("2024-01-01T00:00:00Z".to_string()),
                ease_factor: 2.5,
                interval_days: 3,
                next_review_at: Some("2024-01-04T00:00:00Z".to_string()),
                in_srs_pool: true,
                deck_correct_count: 0,
                learning_status: "srs_active".to_string(),
            }],
            phrase_threads: vec![],
            question_threads: vec![],
            notes: vec![ExportNote {
                id: 1,
                content: "Test note".to_string(),
                created_at: "2024-01-01T00:00:00Z".to_string(),
                updated_at: "2024-01-01T00:00:00Z".to_string(),
            }],
            practice_sessions: vec![],
            materials: vec![],
            material_threads: vec![],
            decks: vec![],
        }
    }

    #[test]
    fn test_export_empty_database() {
        let conn = setup_test_db();
        let result = export_data_with_conn(&conn);
        assert!(result.is_ok());

        let data = result.unwrap();
        assert_eq!(data.version, 3);
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
        assert_eq!(import_result.stats.phrase_progress_imported, 1);
        assert_eq!(import_result.stats.notes_imported, 1);
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
        assert_eq!(exported.phrase_progress.len(), 1);
        assert_eq!(exported.phrase_progress[0].correct_streak, 2);
        assert_eq!(exported.notes.len(), 1);
    }

    #[test]
    fn test_import_merge_mode_adds_new() {
        let mut conn = setup_test_db();

        // First import
        let data1 = create_test_export_data();
        import_data_with_conn(&mut conn, data1, ImportMode::Overwrite).expect("First import failed");

        // Second import with different data
        let mut data2 = create_test_export_data();
        data2.phrases[0].id = 2;
        data2.phrases[0].prompt = "Goodbye".to_string();
        data2.phrases[0].answer = "Tschüss".to_string();
        data2.phrases[0].created_at = "2024-01-02T00:00:00Z".to_string();
        data2.phrase_progress[0].id = 2;
        data2.phrase_progress[0].phrase_id = 2;
        data2.notes[0].id = 2;
        data2.notes[0].content = "Another note".to_string();
        data2.notes[0].created_at = "2024-01-02T00:00:00Z".to_string();

        let result = import_data_with_conn(&mut conn, data2, ImportMode::Merge);
        assert!(result.is_ok());

        // Verify both sets of data exist
        let exported = export_data_with_conn(&conn).expect("Export failed");
        assert_eq!(exported.phrases.len(), 2);
        assert_eq!(exported.notes.len(), 2);
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
        assert_eq!(import_result.stats.notes_imported, 0);

        // Verify no duplicates
        let exported = export_data_with_conn(&conn).expect("Export failed");
        assert_eq!(exported.phrases.len(), 1);
        assert_eq!(exported.notes.len(), 1);
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
    fn test_import_preserves_foreign_key_relationships() {
        let mut conn = setup_test_db();

        let data = create_test_export_data();
        import_data_with_conn(&mut conn, data, ImportMode::Overwrite).expect("Import failed");

        // Verify progress is linked to phrase
        let progress_phrase_id: i64 = conn
            .query_row(
                "SELECT phrase_id FROM phrase_progress WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .expect("Query failed");
        assert_eq!(progress_phrase_id, 1);
    }

    #[test]
    fn test_export_includes_all_phrase_fields() {
        let conn = setup_test_db();

        // Insert a phrase with all fields populated
        conn.execute(
            "INSERT INTO phrases (id, prompt, answer, accepted_json,
                                  target_language, native_language, audio_path, notes,
                                  starred, excluded, created_at)
             VALUES (1, 'Hello', 'Hallo', '[\"Hi\"]', 'de', 'en', '/path/to/audio.mp3',
                     'A greeting', 1, 0, '2024-01-01')",
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
        assert!(!phrase.excluded);
    }
}
