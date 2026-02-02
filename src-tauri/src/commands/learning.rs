use crate::db::get_conn;
use crate::models::{IntervalDistribution, LearningStats, PhraseProgress, PhraseWithProgress, PracticeSession, SessionState, SrsStats};
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
    new_phrase_count: Option<i32>,
    new_phrase_limit: Option<i32>,
) -> Result<Option<PhraseWithProgress>, String> {
    let conn = get_conn()?;

    // Build query with parameter placeholders
    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // Always exclude phrases marked as excluded
    conditions.push("(p.excluded = 0 OR p.excluded IS NULL)".to_string());

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
                p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.excluded, p.created_at, p.material_id,
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
            let excluded_int: i32 = row.get(10).unwrap_or(0);

            let phrase = crate::models::Phrase {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                material_id: row.get(12).ok(),
                prompt: row.get(2)?,
                answer: row.get(3)?,
                accepted,
                target_language: row.get(5)?,
                native_language: row.get(6)?,
                audio_path: row.get(7)?,
                notes: row.get(8)?,
                starred: starred_int != 0,
                excluded: excluded_int != 0,
                created_at: row.get(11)?,
            };

            let progress: Option<PhraseProgress> = row.get::<_, Option<i64>>(13)?.map(|progress_id| {
                PhraseProgress {
                    id: progress_id,
                    phrase_id: phrase.id,
                    correct_streak: row.get(14).unwrap_or(0),
                    total_attempts: row.get(15).unwrap_or(0),
                    success_count: row.get(16).unwrap_or(0),
                    last_seen: row.get(17).ok(),
                    ease_factor: row.get(18).unwrap_or(2.5),
                    interval_days: row.get(19).unwrap_or(1),
                    next_review_at: row.get(20).ok(),
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

    // Check if we've hit the new phrase limit
    let limit_new_phrases = match (new_phrase_count, new_phrase_limit) {
        (Some(count), Some(limit)) if limit > 0 => count >= limit,
        _ => false,
    };

    // Calculate priorities
    let mut phrases_with_priority: Vec<(PhraseWithProgress, f64)> = phrases
        .into_iter()
        .map(|p| {
            let mut priority = calculate_priority(&p.progress);

            // If we've hit the new phrase limit, skip new phrases (priority 1000)
            // New phrases have priority 1000.0 (no progress or total_attempts == 0)
            if limit_new_phrases && priority == 1000.0 {
                priority = 0.0;
            }

            (p, priority)
        })
        .collect();

    // Sort by priority descending
    phrases_with_priority.sort_by(|a, b| {
        b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal)
    });

    // Only return phrases with priority > 0 (due for review or new)
    // Phrases not yet due (priority 0) should NOT be shown - that's the point of SRS
    let next_phrase = phrases_with_priority
        .iter()
        .find(|(_, priority)| *priority > 0.0)
        .map(|(phrase, _)| phrase.clone());

    Ok(next_phrase)
}

/// Calculate next review date using simplified SM-2 algorithm
/// For learning phase (interval_days == 0), use short intervals (minutes)
/// For review phase (interval_days >= 1), use SRS with days
fn calculate_srs(
    is_correct: bool,
    current_ease: f64,
    current_interval: i32,
    correct_streak: i32,
) -> (f64, i32, String) {
    let min_ease = 1.3;
    let now = chrono::Utc::now();

    // Learning phase: streak < 2, use short intervals
    let is_learning = correct_streak < 2;

    if is_correct {
        if is_learning {
            // Still learning - keep interval at 0 (same session) until streak reaches 2
            // Then graduate to 1 day
            let new_interval = if correct_streak + 1 >= 2 { 1 } else { 0 };
            let next_review = if new_interval == 0 {
                now + chrono::Duration::minutes(10) // Review again in 10 minutes
            } else {
                now + chrono::Duration::days(1) // Graduate to 1 day
            };
            let next_review_str = next_review.format("%Y-%m-%d %H:%M:%S").to_string();
            (current_ease, new_interval, next_review_str)
        } else {
            // Review phase: multiply interval by ease factor
            let new_interval = ((current_interval as f64) * current_ease).round() as i32;
            // Ensure interval increases by at least 1 day
            let new_interval = new_interval.max(current_interval + 1);
            let next_review = now + chrono::Duration::days(new_interval as i64);
            let next_review_str = next_review.format("%Y-%m-%d %H:%M:%S").to_string();
            (current_ease, new_interval, next_review_str)
        }
    } else {
        // Incorrect answer: reset to learning phase
        let new_ease = (current_ease - 0.2).max(min_ease);
        let new_interval = 0; // Back to learning phase
        let next_review = now + chrono::Duration::minutes(5); // Review again in 5 minutes
        let next_review_str = next_review.format("%Y-%m-%d %H:%M:%S").to_string();
        (new_ease, new_interval, next_review_str)
    }
}

#[tauri::command]
pub fn record_answer(phrase_id: i64, is_correct: bool) -> Result<PhraseProgress, String> {
    let conn = get_conn()?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Check if progress record exists and get current SRS values
    let existing: Option<(i64, f64, i32, i32)> = conn
        .query_row(
            "SELECT id, ease_factor, interval_days, correct_streak FROM phrase_progress WHERE phrase_id = ?1",
            params![phrase_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .ok();

    if let Some((_, current_ease, current_interval, current_streak)) = existing {
        // Calculate new SRS values (pass current streak for learning vs review phase)
        let (new_ease, new_interval, next_review) =
            calculate_srs(is_correct, current_ease, current_interval, current_streak);

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
        // Create new progress record with initial SRS values (streak is 0 for new phrase)
        let (new_ease, new_interval, next_review) = calculate_srs(is_correct, 2.5, 0, 0);

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
        "SELECT id, started_at, finished_at, total_phrases, correct_answers, exercise_mode, state_json
         FROM practice_sessions WHERE id = ?1",
        params![id],
        |row| {
            let state_json: Option<String> = row.get(6)?;
            let state = state_json.and_then(|json| serde_json::from_str(&json).ok());
            Ok(PracticeSession {
                id: row.get(0)?,
                started_at: row.get(1)?,
                finished_at: row.get(2)?,
                total_phrases: row.get(3)?,
                correct_answers: row.get(4)?,
                exercise_mode: row.get(5)?,
                state,
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

    // Clear state and set finished_at
    conn.execute(
        "UPDATE practice_sessions SET finished_at = datetime('now'), state_json = NULL WHERE id = ?1",
        params![session_id],
    )
    .map_err(|e| format!("Failed to finish session: {}", e))?;

    conn.query_row(
        "SELECT id, started_at, finished_at, total_phrases, correct_answers, exercise_mode, state_json
         FROM practice_sessions WHERE id = ?1",
        params![session_id],
        |row| {
            let state_json: Option<String> = row.get(6)?;
            let state = state_json.and_then(|json| serde_json::from_str(&json).ok());
            Ok(PracticeSession {
                id: row.get(0)?,
                started_at: row.get(1)?,
                finished_at: row.get(2)?,
                total_phrases: row.get(3)?,
                correct_answers: row.get(4)?,
                exercise_mode: row.get(5)?,
                state,
            })
        },
    )
    .map_err(|e| format!("Failed to get session: {}", e))
}

#[tauri::command]
pub fn save_session_state(session_id: i64, state: SessionState) -> Result<(), String> {
    let conn = get_conn()?;

    let state_json = serde_json::to_string(&state)
        .map_err(|e| format!("Failed to serialize state: {}", e))?;

    conn.execute(
        "UPDATE practice_sessions SET state_json = ?1 WHERE id = ?2",
        params![state_json, session_id],
    )
    .map_err(|e| format!("Failed to save session state: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_active_session(_target_language: Option<String>) -> Result<Option<PracticeSession>, String> {
    let conn = get_conn()?;

    // Get the most recent unfinished session
    // If target_language is provided, we should also check if the session was for that language
    // For now, just get any unfinished session
    let result = conn.query_row(
        "SELECT id, started_at, finished_at, total_phrases, correct_answers, exercise_mode, state_json
         FROM practice_sessions
         WHERE finished_at IS NULL
         ORDER BY started_at DESC
         LIMIT 1",
        [],
        |row| {
            let state_json: Option<String> = row.get(6)?;
            let state = state_json.and_then(|json| serde_json::from_str(&json).ok());
            Ok(PracticeSession {
                id: row.get(0)?,
                started_at: row.get(1)?,
                finished_at: row.get(2)?,
                total_phrases: row.get(3)?,
                correct_answers: row.get(4)?,
                exercise_mode: row.get(5)?,
                state,
            })
        },
    );

    match result {
        Ok(session) => Ok(Some(session)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get active session: {}", e)),
    }
}

#[tauri::command]
pub fn reset_learning_phrases() -> Result<i32, String> {
    let conn = get_conn()?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Reset all phrases in learning state (correct_streak < 2) to be due now
    let count = conn
        .execute(
            "UPDATE phrase_progress SET next_review_at = ?1, interval_days = 0 WHERE correct_streak < 2",
            params![now],
        )
        .map_err(|e| format!("Failed to reset learning phrases: {}", e))?;

    Ok(count as i32)
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

#[tauri::command]
pub fn get_srs_stats(target_language: Option<String>) -> Result<SrsStats, String> {
    let conn = get_conn()?;
    let now = chrono::Utc::now().naive_utc();
    let today_end = now.date().and_hms_opt(23, 59, 59).unwrap();
    let tomorrow_end = today_end + chrono::Duration::days(1);
    let week_end = today_end + chrono::Duration::days(7);

    let now_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
    let today_str = today_end.format("%Y-%m-%d %H:%M:%S").to_string();
    let tomorrow_str = tomorrow_end.format("%Y-%m-%d %H:%M:%S").to_string();
    let week_str = week_end.format("%Y-%m-%d %H:%M:%S").to_string();

    // Build language filter clause
    let (lang_join, lang_filter) = match &target_language {
        Some(_) => (
            "INNER JOIN phrases p ON pp.phrase_id = p.id",
            "AND p.target_language = ?",
        ),
        None => ("", ""),
    };

    // Due now (overdue)
    let overdue: i32 = {
        let query = format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE pp.next_review_at < ?1 {}",
            lang_join, lang_filter
        );
        match &target_language {
            Some(lang) => conn
                .query_row(&query, params![now_str, lang], |row| row.get(0))
                .unwrap_or(0),
            None => conn
                .query_row(
                    "SELECT COUNT(*) FROM phrase_progress WHERE next_review_at < ?1",
                    params![now_str],
                    |row| row.get(0),
                )
                .unwrap_or(0),
        }
    };

    // Due today (including overdue)
    let due_today: i32 = {
        let query = format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE pp.next_review_at <= ?1 {}",
            lang_join, lang_filter
        );
        match &target_language {
            Some(lang) => conn
                .query_row(&query, params![today_str, lang], |row| row.get(0))
                .unwrap_or(0),
            None => conn
                .query_row(
                    "SELECT COUNT(*) FROM phrase_progress WHERE next_review_at <= ?1",
                    params![today_str],
                    |row| row.get(0),
                )
                .unwrap_or(0),
        }
    };

    // Due tomorrow
    let due_tomorrow: i32 = {
        let query = format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE pp.next_review_at > ?1 AND pp.next_review_at <= ?2 {}",
            lang_join, lang_filter
        );
        match &target_language {
            Some(lang) => conn
                .query_row(&query, params![today_str, tomorrow_str, lang], |row| row.get(0))
                .unwrap_or(0),
            None => conn
                .query_row(
                    "SELECT COUNT(*) FROM phrase_progress WHERE next_review_at > ?1 AND next_review_at <= ?2",
                    params![today_str, tomorrow_str],
                    |row| row.get(0),
                )
                .unwrap_or(0),
        }
    };

    // Due this week
    let due_this_week: i32 = {
        let query = format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE pp.next_review_at > ?1 AND pp.next_review_at <= ?2 {}",
            lang_join, lang_filter
        );
        match &target_language {
            Some(lang) => conn
                .query_row(&query, params![today_str, week_str, lang], |row| row.get(0))
                .unwrap_or(0),
            None => conn
                .query_row(
                    "SELECT COUNT(*) FROM phrase_progress WHERE next_review_at > ?1 AND next_review_at <= ?2",
                    params![today_str, week_str],
                    |row| row.get(0),
                )
                .unwrap_or(0),
        }
    };

    // Total phrases with reviews scheduled
    let total_reviews: i32 = {
        let query = format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE pp.next_review_at IS NOT NULL {}",
            lang_join,
            if target_language.is_some() {
                "AND p.target_language = ?1"
            } else {
                ""
            }
        );
        match &target_language {
            Some(lang) => conn
                .query_row(&query, params![lang], |row| row.get(0))
                .unwrap_or(0),
            None => conn
                .query_row(
                    "SELECT COUNT(*) FROM phrase_progress WHERE next_review_at IS NOT NULL",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(0),
        }
    };

    // Average ease factor
    let average_ease_factor: f64 = {
        let query = format!(
            "SELECT COALESCE(AVG(pp.ease_factor), 2.5) FROM phrase_progress pp {} {}",
            lang_join,
            if target_language.is_some() {
                "WHERE p.target_language = ?1"
            } else {
                ""
            }
        );
        match &target_language {
            Some(lang) => conn
                .query_row(&query, params![lang], |row| row.get(0))
                .unwrap_or(2.5),
            None => conn
                .query_row(
                    "SELECT COALESCE(AVG(ease_factor), 2.5) FROM phrase_progress",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or(2.5),
        }
    };

    // Interval distribution - helper macro
    let interval_count = |condition: &str| -> i32 {
        let query = format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE {} {}",
            lang_join,
            condition,
            if target_language.is_some() {
                "AND p.target_language = ?1"
            } else {
                ""
            }
        );
        match &target_language {
            Some(lang) => conn
                .query_row(&query, params![lang], |row| row.get(0))
                .unwrap_or(0),
            None => {
                let simple_query = format!(
                    "SELECT COUNT(*) FROM phrase_progress WHERE {}",
                    condition
                );
                conn.query_row(&simple_query, [], |row| row.get(0))
                    .unwrap_or(0)
            }
        }
    };

    let one_day = interval_count("pp.interval_days = 1");
    let two_to_three_days = interval_count("pp.interval_days >= 2 AND pp.interval_days <= 3");
    let four_to_seven_days = interval_count("pp.interval_days >= 4 AND pp.interval_days <= 7");
    let one_to_two_weeks = interval_count("pp.interval_days >= 8 AND pp.interval_days <= 14");
    let two_weeks_plus = interval_count("pp.interval_days > 14");

    Ok(SrsStats {
        due_now: overdue,
        overdue,
        due_today,
        due_tomorrow,
        due_this_week,
        total_reviews,
        average_ease_factor,
        interval_distribution: IntervalDistribution {
            one_day,
            two_to_three_days,
            four_to_seven_days,
            one_to_two_weeks,
            two_weeks_plus,
        },
    })
}

#[tauri::command]
pub fn get_practice_sessions(limit: Option<i32>) -> Result<Vec<PracticeSession>, String> {
    let conn = get_conn()?;
    let limit = limit.unwrap_or(20);

    let mut stmt = conn
        .prepare(
            "SELECT id, started_at, finished_at, total_phrases, correct_answers, exercise_mode, state_json
             FROM practice_sessions
             ORDER BY started_at DESC
             LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let sessions = stmt
        .query_map(params![limit], |row| {
            let state_json: Option<String> = row.get(6)?;
            let state = state_json.and_then(|json| serde_json::from_str(&json).ok());
            Ok(PracticeSession {
                id: row.get(0)?,
                started_at: row.get(1)?,
                finished_at: row.get(2)?,
                total_phrases: row.get(3)?,
                correct_answers: row.get(4)?,
                exercise_mode: row.get(5)?,
                state,
            })
        })
        .map_err(|e| format!("Failed to query sessions: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect sessions: {}", e))?;

    Ok(sessions)
}

/// Validate an answer against the phrase's correct answer and accepted alternatives
#[tauri::command]
pub fn validate_answer(phrase_id: i64, input: String) -> Result<bool, String> {
    let conn = get_conn()?;

    // Load settings to check fuzzy_matching flag
    let fuzzy_matching: bool = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'fuzzy_matching'",
            [],
            |row| {
                let val: String = row.get(0)?;
                Ok(val == "true")
            },
        )
        .unwrap_or(true); // Default to true if not set

    let (answer, accepted_json): (String, String) = conn
        .query_row(
            "SELECT answer, accepted_json FROM phrases WHERE id = ?1",
            params![phrase_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Phrase not found: {}", e))?;

    let accepted: Vec<String> = serde_json::from_str(&accepted_json).unwrap_or_default();

    // Normalize input for comparison (preserves spaces)
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

    // Normalize without spaces (for compound word comparison like "da lassen" vs "dalassen")
    let normalize_no_spaces = |s: &str| -> String {
        s.to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric())
            .collect::<String>()
    };

    // Levenshtein distance for fuzzy matching (handles Whisper transcription errors)
    fn levenshtein(a: &str, b: &str) -> usize {
        let a_chars: Vec<char> = a.chars().collect();
        let b_chars: Vec<char> = b.chars().collect();
        let a_len = a_chars.len();
        let b_len = b_chars.len();

        if a_len == 0 { return b_len; }
        if b_len == 0 { return a_len; }

        let mut matrix = vec![vec![0usize; b_len + 1]; a_len + 1];

        for i in 0..=a_len { matrix[i][0] = i; }
        for j in 0..=b_len { matrix[0][j] = j; }

        for i in 1..=a_len {
            for j in 1..=b_len {
                let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
                matrix[i][j] = (matrix[i - 1][j] + 1)
                    .min(matrix[i][j - 1] + 1)
                    .min(matrix[i - 1][j - 1] + cost);
            }
        }
        matrix[a_len][b_len]
    }

    // Check if fuzzy match (allow small errors for longer strings)
    // e.g., "Parkpläzze" vs "Parkplätze" = distance 2, length 10 = 20% error = OK
    fn is_fuzzy_match(input: &str, expected: &str) -> bool {
        let distance = levenshtein(input, expected);
        let max_len = input.len().max(expected.len());
        if max_len == 0 { return true; }

        // Allow up to 20% error rate, minimum 1 char for short words, max 2 chars total
        let max_distance = (max_len / 5).max(1).min(2);
        distance <= max_distance
    }

    let normalized_input = normalize(&input);
    let normalized_answer = normalize(&answer);
    let input_no_spaces = normalize_no_spaces(&input);
    let answer_no_spaces = normalize_no_spaces(&answer);

    // Check main answer (exact match with spaces)
    if normalized_input == normalized_answer {
        return Ok(true);
    }

    // Check main answer (without spaces - handles compound words)
    if input_no_spaces == answer_no_spaces {
        return Ok(true);
    }

    // Fuzzy match for Whisper transcription errors (e.g., "Parkpläzze" vs "Parkplätze")
    if fuzzy_matching && is_fuzzy_match(&input_no_spaces, &answer_no_spaces) {
        return Ok(true);
    }

    // Check accepted alternatives
    for alt in &accepted {
        if normalize(alt) == normalized_input {
            return Ok(true);
        }
        let alt_no_spaces = normalize_no_spaces(alt);
        if alt_no_spaces == input_no_spaces {
            return Ok(true);
        }
        // Fuzzy match alternatives too
        if fuzzy_matching && is_fuzzy_match(&input_no_spaces, &alt_no_spaces) {
            return Ok(true);
        }
    }

    Ok(false)
}
