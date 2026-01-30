use crate::db::get_conn;
use crate::models::{LearningStats, PhraseProgress, PhraseWithProgress, PracticeSession};
use rusqlite::params;

/// Calculate priority for SRS-based scheduling
/// Higher priority = should be shown sooner
/// Priority levels:
/// - Due for review (next_review_at <= now): 2000 + overdue_hours (most urgent first)
/// - New phrases (no progress): 1000
/// - Not yet due: 0 (skip these)
fn calculate_priority(progress: &Option<PhraseProgress>) -> f64 {
    match progress {
        None => 1000.0, // New phrases get high priority
        Some(p) => {
            if p.total_attempts == 0 {
                return 1000.0; // Never practiced = treat as new
            }

            // Check if due for review based on next_review_at
            match &p.next_review_at {
                Some(next_review) => {
                    match chrono::NaiveDateTime::parse_from_str(next_review, "%Y-%m-%d %H:%M:%S") {
                        Ok(review_dt) => {
                            let now = chrono::Utc::now().naive_utc();
                            if review_dt <= now {
                                // Due or overdue - higher priority for more overdue
                                let overdue_hours = now.signed_duration_since(review_dt).num_hours() as f64;
                                2000.0 + overdue_hours
                            } else {
                                // Not yet due - very low priority
                                0.0
                            }
                        }
                        Err(_) => 500.0, // Parse error - medium priority
                    }
                }
                None => 500.0, // No next_review_at set - medium priority (legacy data)
            }
        }
    }
}

#[tauri::command]
pub fn get_next_phrase(
    target_language: Option<String>,
    exclude_ids: Option<Vec<i64>>,
) -> Result<Option<PhraseWithProgress>, String> {
    let conn = get_conn()?;

    // Build query with parameter placeholders
    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref lang) = target_language {
        conditions.push("p.target_language = ?".to_string());
        param_values.push(Box::new(lang.clone()));
    }

    // For exclude_ids, we build placeholders dynamically but values are still parameterized
    if let Some(ref ids) = exclude_ids {
        if !ids.is_empty() {
            let placeholders: Vec<&str> = ids.iter().map(|_| "?").collect();
            conditions.push(format!("p.id NOT IN ({})", placeholders.join(",")));
            for id in ids {
                param_values.push(Box::new(*id));
            }
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" AND {}", conditions.join(" AND "))
    };

    let query = format!(
        "SELECT p.id, p.conversation_id, p.prompt, p.answer, p.accepted_json,
                p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.created_at,
                pp.id as progress_id, pp.correct_streak, pp.total_attempts, pp.success_count, pp.last_seen,
                pp.ease_factor, pp.interval_days, pp.next_review_at
         FROM phrases p
         LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
         WHERE 1=1{}",
        where_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let params: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let phrases: Vec<PhraseWithProgress> = stmt
        .query_map(params.as_slice(), |row| {
            let accepted_json: String = row.get(4)?;
            let accepted: Vec<String> = serde_json::from_str(&accepted_json).unwrap_or_default();
            let starred_int: i32 = row.get(9)?;

            let phrase = crate::models::Phrase {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                prompt: row.get(2)?,
                answer: row.get(3)?,
                accepted,
                target_language: row.get(5)?,
                native_language: row.get(6)?,
                audio_path: row.get(7)?,
                notes: row.get(8)?,
                starred: starred_int != 0,
                created_at: row.get(10)?,
            };

            let progress: Option<PhraseProgress> = row.get::<_, Option<i64>>(11)?.map(|progress_id| {
                PhraseProgress {
                    id: progress_id,
                    phrase_id: phrase.id,
                    correct_streak: row.get(12).unwrap_or(0),
                    total_attempts: row.get(13).unwrap_or(0),
                    success_count: row.get(14).unwrap_or(0),
                    last_seen: row.get(15).ok(),
                    ease_factor: row.get(16).unwrap_or(2.5),
                    interval_days: row.get(17).unwrap_or(1),
                    next_review_at: row.get(18).ok(),
                }
            });

            Ok(PhraseWithProgress { phrase, progress })
        })
        .map_err(|e| format!("Failed to query phrases: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect phrases: {}", e))?;

    if phrases.is_empty() {
        return Ok(None);
    }

    // Calculate priorities and filter out phrases with priority 0 (not yet due)
    // unless there are no phrases with priority > 0
    let mut phrases_with_priority: Vec<(PhraseWithProgress, f64)> = phrases
        .into_iter()
        .map(|p| {
            let priority = calculate_priority(&p.progress);
            (p, priority)
        })
        .collect();

    // Sort by priority descending
    phrases_with_priority.sort_by(|a, b| {
        b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal)
    });

    // Get the phrase with highest priority, but only if priority > 0
    // (meaning it's due for review or is a new phrase)
    let next_phrase = phrases_with_priority
        .into_iter()
        .find(|(_, priority)| *priority > 0.0)
        .map(|(phrase, _)| phrase);

    Ok(next_phrase)
}

/// Calculate next review date using simplified SM-2 algorithm
fn calculate_srs(
    is_correct: bool,
    current_ease: f64,
    current_interval: i32,
) -> (f64, i32, String) {
    let min_ease = 1.3;
    let now = chrono::Utc::now();

    if is_correct {
        // Correct answer: multiply interval by ease factor
        let new_interval = ((current_interval as f64) * current_ease).round() as i32;
        // Ensure interval increases by at least 1 day
        let new_interval = new_interval.max(current_interval + 1);
        let next_review = now + chrono::Duration::days(new_interval as i64);
        let next_review_str = next_review.format("%Y-%m-%d %H:%M:%S").to_string();

        (current_ease, new_interval, next_review_str)
    } else {
        // Incorrect answer: reset interval to 1, decrease ease
        let new_ease = (current_ease - 0.2).max(min_ease);
        let new_interval = 1;
        let next_review = now + chrono::Duration::days(1);
        let next_review_str = next_review.format("%Y-%m-%d %H:%M:%S").to_string();

        (new_ease, new_interval, next_review_str)
    }
}

#[tauri::command]
pub fn record_answer(phrase_id: i64, is_correct: bool) -> Result<PhraseProgress, String> {
    let conn = get_conn()?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Check if progress record exists and get current SRS values
    let existing: Option<(i64, f64, i32)> = conn
        .query_row(
            "SELECT id, ease_factor, interval_days FROM phrase_progress WHERE phrase_id = ?1",
            params![phrase_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok();

    if let Some((_, current_ease, current_interval)) = existing {
        // Calculate new SRS values
        let (new_ease, new_interval, next_review) =
            calculate_srs(is_correct, current_ease, current_interval);

        // Update existing progress
        if is_correct {
            conn.execute(
                "UPDATE phrase_progress SET
                    correct_streak = correct_streak + 1,
                    total_attempts = total_attempts + 1,
                    success_count = success_count + 1,
                    last_seen = ?1,
                    ease_factor = ?2,
                    interval_days = ?3,
                    next_review_at = ?4
                 WHERE phrase_id = ?5",
                params![now, new_ease, new_interval, next_review, phrase_id],
            )
            .map_err(|e| format!("Failed to update progress: {}", e))?;
        } else {
            conn.execute(
                "UPDATE phrase_progress SET
                    correct_streak = 0,
                    total_attempts = total_attempts + 1,
                    last_seen = ?1,
                    ease_factor = ?2,
                    interval_days = ?3,
                    next_review_at = ?4
                 WHERE phrase_id = ?5",
                params![now, new_ease, new_interval, next_review, phrase_id],
            )
            .map_err(|e| format!("Failed to update progress: {}", e))?;
        }
    } else {
        // Create new progress record with initial SRS values
        let (new_ease, new_interval, next_review) = calculate_srs(is_correct, 2.5, 1);

        conn.execute(
            "INSERT INTO phrase_progress (phrase_id, correct_streak, total_attempts, success_count, last_seen, ease_factor, interval_days, next_review_at)
             VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6, ?7)",
            params![
                phrase_id,
                if is_correct { 1 } else { 0 },
                if is_correct { 1 } else { 0 },
                now,
                new_ease,
                new_interval,
                next_review
            ],
        )
        .map_err(|e| format!("Failed to create progress: {}", e))?;
    }

    // Return updated progress
    conn.query_row(
        "SELECT id, phrase_id, correct_streak, total_attempts, success_count, last_seen, ease_factor, interval_days, next_review_at
         FROM phrase_progress WHERE phrase_id = ?1",
        params![phrase_id],
        |row| {
            Ok(PhraseProgress {
                id: row.get(0)?,
                phrase_id: row.get(1)?,
                correct_streak: row.get(2)?,
                total_attempts: row.get(3)?,
                success_count: row.get(4)?,
                last_seen: row.get(5)?,
                ease_factor: row.get(6)?,
                interval_days: row.get(7)?,
                next_review_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get progress: {}", e))
}

#[tauri::command]
pub fn get_learning_stats(target_language: Option<String>) -> Result<LearningStats, String> {
    let conn = get_conn()?;

    // Use parameterized queries for language filter
    let (lang_filter, params): (&str, Vec<&dyn rusqlite::ToSql>) = match &target_language {
        Some(lang) => (" AND p.target_language = ?", vec![lang as &dyn rusqlite::ToSql]),
        None => ("", vec![]),
    };

    // Total phrases
    let total_phrases: i32 = conn
        .query_row(
            &format!("SELECT COUNT(*) FROM phrases p WHERE 1=1{}", lang_filter),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Learned (streak >= required_streak, default 2)
    let learned_count: i32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM phrases p
                 JOIN phrase_progress pp ON p.id = pp.phrase_id
                 WHERE pp.correct_streak >= 2{}",
                lang_filter
            ),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Learning (has progress but streak < required)
    let learning_count: i32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM phrases p
                 JOIN phrase_progress pp ON p.id = pp.phrase_id
                 WHERE pp.correct_streak < 2 AND pp.total_attempts > 0{}",
                lang_filter
            ),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0);

    // New (no progress)
    let new_count = total_phrases - learned_count - learning_count;

    // Average success rate
    let average_success_rate: f64 = conn
        .query_row(
            &format!(
                "SELECT COALESCE(AVG(CAST(pp.success_count AS REAL) / NULLIF(pp.total_attempts, 0)), 0)
                 FROM phrases p
                 JOIN phrase_progress pp ON p.id = pp.phrase_id
                 WHERE 1=1{}",
                lang_filter
            ),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Total sessions
    let total_sessions: i32 = conn
        .query_row("SELECT COUNT(*) FROM practice_sessions", [], |row| {
            row.get(0)
        })
        .unwrap_or(0);

    Ok(LearningStats {
        total_phrases,
        learned_count,
        learning_count,
        new_count,
        average_success_rate,
        total_sessions,
    })
}

#[tauri::command]
pub fn start_practice_session(exercise_mode: String) -> Result<PracticeSession, String> {
    let conn = get_conn()?;

    conn.execute(
        "INSERT INTO practice_sessions (exercise_mode) VALUES (?1)",
        params![exercise_mode],
    )
    .map_err(|e| format!("Failed to create session: {}", e))?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, started_at, finished_at, total_phrases, correct_answers, exercise_mode
         FROM practice_sessions WHERE id = ?1",
        params![id],
        |row| {
            Ok(PracticeSession {
                id: row.get(0)?,
                started_at: row.get(1)?,
                finished_at: row.get(2)?,
                total_phrases: row.get(3)?,
                correct_answers: row.get(4)?,
                exercise_mode: row.get(5)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get session: {}", e))
}

#[tauri::command]
pub fn update_practice_session(
    session_id: i64,
    total_phrases: i32,
    correct_answers: i32,
) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE practice_sessions SET total_phrases = ?1, correct_answers = ?2 WHERE id = ?3",
        params![total_phrases, correct_answers, session_id],
    )
    .map_err(|e| format!("Failed to update session: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn finish_practice_session(session_id: i64) -> Result<PracticeSession, String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE practice_sessions SET finished_at = datetime('now') WHERE id = ?1",
        params![session_id],
    )
    .map_err(|e| format!("Failed to finish session: {}", e))?;

    conn.query_row(
        "SELECT id, started_at, finished_at, total_phrases, correct_answers, exercise_mode
         FROM practice_sessions WHERE id = ?1",
        params![session_id],
        |row| {
            Ok(PracticeSession {
                id: row.get(0)?,
                started_at: row.get(1)?,
                finished_at: row.get(2)?,
                total_phrases: row.get(3)?,
                correct_answers: row.get(4)?,
                exercise_mode: row.get(5)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get session: {}", e))
}

#[tauri::command]
pub fn reset_progress(phrase_id: Option<i64>) -> Result<(), String> {
    let conn = get_conn()?;

    if let Some(id) = phrase_id {
        conn.execute("DELETE FROM phrase_progress WHERE phrase_id = ?1", params![id])
            .map_err(|e| format!("Failed to reset progress: {}", e))?;
    } else {
        conn.execute("DELETE FROM phrase_progress", [])
            .map_err(|e| format!("Failed to reset all progress: {}", e))?;
    }

    Ok(())
}

/// Validate an answer against the phrase's correct answer and accepted alternatives
#[tauri::command]
pub fn validate_answer(phrase_id: i64, input: String) -> Result<bool, String> {
    let conn = get_conn()?;

    let (answer, accepted_json): (String, String) = conn
        .query_row(
            "SELECT answer, accepted_json FROM phrases WHERE id = ?1",
            params![phrase_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Phrase not found: {}", e))?;

    let accepted: Vec<String> = serde_json::from_str(&accepted_json).unwrap_or_default();

    // Normalize input for comparison
    let normalize = |s: &str| -> String {
        s.to_lowercase()
            .trim()
            .chars()
            .filter(|c| c.is_alphanumeric() || c.is_whitespace())
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
    };

    let normalized_input = normalize(&input);
    let normalized_answer = normalize(&answer);

    // Check main answer
    if normalized_input == normalized_answer {
        return Ok(true);
    }

    // Check accepted alternatives
    for alt in accepted {
        if normalize(&alt) == normalized_input {
            return Ok(true);
        }
    }

    Ok(false)
}
