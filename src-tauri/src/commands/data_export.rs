use crate::db::get_conn;
use crate::models::{
    ExportConversation, ExportData, ExportNote, ExportPhrase, ExportPhraseProgress,
    ExportPhraseThread, ExportPracticeSession, ExportQuestionThread, ExportSetting, ImportMode,
    ImportResult, ImportStats,
};
use rusqlite::params;
use std::collections::HashMap;

#[tauri::command]
pub fn export_data() -> Result<ExportData, String> {
    let conn = get_conn()?;

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

    // Export conversations
    let mut stmt = conn
        .prepare(
            "SELECT id, title, subject, target_language, native_language, status,
                    raw_messages_json, final_messages_json, llm_summary, created_at, updated_at
             FROM conversations",
        )
        .map_err(|e| format!("Failed to prepare conversations query: {}", e))?;
    let conversations = stmt
        .query_map([], |row| {
            Ok(ExportConversation {
                id: row.get(0)?,
                title: row.get(1)?,
                subject: row.get(2)?,
                target_language: row.get(3)?,
                native_language: row.get(4)?,
                status: row.get(5)?,
                raw_messages_json: row.get(6)?,
                final_messages_json: row.get(7)?,
                llm_summary: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("Failed to query conversations: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect conversations: {}", e))?;
    drop(stmt);

    // Export phrases
    let mut stmt = conn
        .prepare(
            "SELECT id, conversation_id, prompt, answer, accepted_json, target_language,
                    native_language, audio_path, notes, starred, excluded, created_at
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
                    last_seen, ease_factor, interval_days, next_review_at
             FROM phrase_progress",
        )
        .map_err(|e| format!("Failed to prepare phrase_progress query: {}", e))?;
    let phrase_progress = stmt
        .query_map([], |row| {
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

    Ok(ExportData {
        version: 1,
        exported_at: chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        settings,
        conversations,
        phrases,
        phrase_progress,
        phrase_threads,
        question_threads,
        notes,
        practice_sessions,
    })
}

#[tauri::command]
pub fn import_data(data: ExportData, mode: ImportMode) -> Result<ImportResult, String> {
    let mut conn = get_conn()?;

    // Check version compatibility
    if data.version > 1 {
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
            tx.execute("DELETE FROM phrases", [])
                .map_err(|e| format!("Failed to delete phrases: {}", e))?;
            tx.execute("DELETE FROM conversations", [])
                .map_err(|e| format!("Failed to delete conversations: {}", e))?;
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

            // Import conversations with original IDs
            for conv in &data.conversations {
                tx.execute(
                    "INSERT INTO conversations (id, title, subject, target_language, native_language,
                                               status, raw_messages_json, final_messages_json, llm_summary,
                                               created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    params![
                        conv.id,
                        conv.title,
                        conv.subject,
                        conv.target_language,
                        conv.native_language,
                        conv.status,
                        conv.raw_messages_json,
                        conv.final_messages_json,
                        conv.llm_summary,
                        conv.created_at,
                        conv.updated_at
                    ],
                )
                .map_err(|e| format!("Failed to import conversation: {}", e))?;
                stats.conversations_imported += 1;
            }

            // Import phrases with original IDs
            for phrase in &data.phrases {
                tx.execute(
                    "INSERT INTO phrases (id, conversation_id, prompt, answer, accepted_json,
                                         target_language, native_language, audio_path, notes,
                                         starred, excluded, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
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
                        phrase.created_at
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
                                                 interval_days, next_review_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        progress.id,
                        progress.phrase_id,
                        progress.correct_streak,
                        progress.total_attempts,
                        progress.success_count,
                        progress.last_seen,
                        progress.ease_factor,
                        progress.interval_days,
                        progress.next_review_at
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
            let mut conversation_id_map: HashMap<i64, i64> = HashMap::new();
            let mut phrase_id_map: HashMap<i64, i64> = HashMap::new();

            // Import conversations (check by created_at + title for uniqueness)
            for conv in &data.conversations {
                let existing: Option<(i64, String)> = tx
                    .query_row(
                        "SELECT id, updated_at FROM conversations WHERE created_at = ?1 AND title = ?2",
                        params![conv.created_at, conv.title],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    )
                    .ok();

                if let Some((existing_id, existing_updated_at)) = existing {
                    // Update if imported data is newer
                    if conv.updated_at > existing_updated_at {
                        tx.execute(
                            "UPDATE conversations SET subject = ?1, target_language = ?2,
                                    native_language = ?3, status = ?4, raw_messages_json = ?5,
                                    final_messages_json = ?6, llm_summary = ?7, updated_at = ?8
                             WHERE id = ?9",
                            params![
                                conv.subject,
                                conv.target_language,
                                conv.native_language,
                                conv.status,
                                conv.raw_messages_json,
                                conv.final_messages_json,
                                conv.llm_summary,
                                conv.updated_at,
                                existing_id
                            ],
                        )
                        .map_err(|e| format!("Failed to update conversation: {}", e))?;
                        stats.conversations_updated += 1;
                    }
                    conversation_id_map.insert(conv.id, existing_id);
                } else {
                    tx.execute(
                        "INSERT INTO conversations (title, subject, target_language, native_language,
                                                   status, raw_messages_json, final_messages_json, llm_summary,
                                                   created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                        params![
                            conv.title,
                            conv.subject,
                            conv.target_language,
                            conv.native_language,
                            conv.status,
                            conv.raw_messages_json,
                            conv.final_messages_json,
                            conv.llm_summary,
                            conv.created_at,
                            conv.updated_at
                        ],
                    )
                    .map_err(|e| format!("Failed to import conversation: {}", e))?;
                    let new_id = tx.last_insert_rowid();
                    conversation_id_map.insert(conv.id, new_id);
                    stats.conversations_imported += 1;
                }
            }

            // Import phrases (check by created_at + prompt + answer for uniqueness)
            for phrase in &data.phrases {
                let mapped_conversation_id = phrase
                    .conversation_id
                    .and_then(|cid| conversation_id_map.get(&cid).copied());

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
                        "INSERT INTO phrases (conversation_id, prompt, answer, accepted_json,
                                             target_language, native_language, audio_path, notes,
                                             starred, excluded, created_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                        params![
                            mapped_conversation_id,
                            phrase.prompt,
                            phrase.answer,
                            phrase.accepted_json,
                            phrase.target_language,
                            phrase.native_language,
                            phrase.audio_path,
                            phrase.notes,
                            phrase.starred as i32,
                            phrase.excluded as i32,
                            phrase.created_at
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
                                                         interval_days, next_review_at)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                            params![
                                new_phrase_id,
                                progress.correct_streak,
                                progress.total_attempts,
                                progress.success_count,
                                progress.last_seen,
                                progress.ease_factor,
                                progress.interval_days,
                                progress.next_review_at
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
