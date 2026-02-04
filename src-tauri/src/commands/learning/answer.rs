//! Answer recording and validation logic.
//!
//! This module handles recording practice answers and updating SRS progress,
//! as well as validating user answers against correct answers.

use crate::constants::srs::DEFAULT_EASE_FACTOR;
use crate::db::get_conn;
use crate::models::{AnswerResult, PhraseProgress, SessionState};
use rusqlite::params;
use std::collections::HashMap;

use super::srs::calculate_next_review;

/// Record a user's answer and update SRS progress.
///
/// Updates the phrase progress with new SRS values based on whether the answer
/// was correct. Also updates session state if a session_id is provided.
#[tauri::command]
pub fn record_answer(
    phrase_id: i64,
    is_correct: bool,
    session_id: Option<i64>,
) -> Result<AnswerResult, String> {
    let conn = get_conn()?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Get required_streak setting (default to 2)
    let required_streak: i32 = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'required_streak'",
            [],
            |row| {
                let val: String = row.get(0)?;
                Ok(val.parse().unwrap_or(2))
            },
        )
        .unwrap_or(2);

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
            calculate_next_review(is_correct, current_ease, current_interval, current_streak);

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
        let (new_ease, new_interval, next_review) =
            calculate_next_review(is_correct, DEFAULT_EASE_FACTOR, 0, 0);

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

    // Get updated progress
    let progress: PhraseProgress = conn
        .query_row(
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
        .map_err(|e| format!("Failed to get progress: {}", e))?;

    // Handle session streak tracking
    let (session_streak, is_learned_in_session) = if let Some(sid) = session_id {
        update_session_streak(&conn, sid, phrase_id, is_correct, required_streak)?
    } else {
        // No session - return 0 for session streak
        (0, false)
    };

    Ok(AnswerResult {
        progress,
        session_streak,
        is_learned_in_session,
    })
}

/// Update session streak tracking for a phrase.
fn update_session_streak(
    conn: &rusqlite::Connection,
    session_id: i64,
    phrase_id: i64,
    is_correct: bool,
    required_streak: i32,
) -> Result<(i32, bool), String> {
    // Load session state
    let state_json: Option<String> = conn
        .query_row(
            "SELECT state_json FROM practice_sessions WHERE id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    let mut session_state: SessionState = state_json
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_else(|| SessionState {
            seen_phrase_ids: vec![],
            session_streaks: HashMap::new(),
            session_learned_ids: vec![],
            new_phrase_count: 0,
            current_phrase_id: None,
            in_retry_mode: false,
            retry_count: 0,
            requires_retry: false,
        });

    // Update session streak
    let current_session_streak = *session_state.session_streaks.get(&phrase_id).unwrap_or(&0);
    let new_session_streak = if is_correct {
        current_session_streak + 1
    } else {
        0
    };
    session_state
        .session_streaks
        .insert(phrase_id, new_session_streak);

    // Update learned IDs
    let is_learned = new_session_streak >= required_streak;
    if is_learned && !session_state.session_learned_ids.contains(&phrase_id) {
        session_state.session_learned_ids.push(phrase_id);
    } else if !is_learned {
        session_state
            .session_learned_ids
            .retain(|&id| id != phrase_id);
    }

    // Save updated session state
    let updated_json = serde_json::to_string(&session_state)
        .map_err(|e| format!("Failed to serialize session state: {}", e))?;
    conn.execute(
        "UPDATE practice_sessions SET state_json = ?1 WHERE id = ?2",
        params![updated_json, session_id],
    )
    .map_err(|e| format!("Failed to save session state: {}", e))?;

    Ok((new_session_streak, is_learned))
}

/// Validate an answer against the phrase's correct answer and accepted alternatives.
///
/// Supports:
/// - Exact matching (case-insensitive)
/// - Compound word matching (ignoring spaces)
/// - Fuzzy matching (for transcription errors, if enabled in settings)
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

    // Check main answer
    if is_answer_match(&input, &answer, fuzzy_matching) {
        return Ok(true);
    }

    // Check accepted alternatives
    for alt in &accepted {
        if is_answer_match(&input, alt, fuzzy_matching) {
            return Ok(true);
        }
    }

    Ok(false)
}

/// Check if input matches expected answer.
fn is_answer_match(input: &str, expected: &str, fuzzy_matching: bool) -> bool {
    let normalized_input = normalize(input);
    let normalized_expected = normalize(expected);
    let input_no_spaces = normalize_no_spaces(input);
    let expected_no_spaces = normalize_no_spaces(expected);

    // Exact match with spaces
    if normalized_input == normalized_expected {
        return true;
    }

    // Without spaces - handles compound words
    if input_no_spaces == expected_no_spaces {
        return true;
    }

    // Fuzzy match for transcription errors
    if fuzzy_matching && is_fuzzy_match(&input_no_spaces, &expected_no_spaces) {
        return true;
    }

    false
}

/// Normalize input for comparison (preserves spaces).
fn normalize(s: &str) -> String {
    s.to_lowercase()
        .trim()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Normalize without spaces (for compound word comparison like "da lassen" vs "dalassen").
fn normalize_no_spaces(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
}

/// Levenshtein distance for fuzzy matching.
fn levenshtein(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let a_len = a_chars.len();
    let b_len = b_chars.len();

    if a_len == 0 {
        return b_len;
    }
    if b_len == 0 {
        return a_len;
    }

    let mut matrix = vec![vec![0usize; b_len + 1]; a_len + 1];

    for (i, row) in matrix.iter_mut().enumerate().take(a_len + 1) {
        row[0] = i;
    }
    for j in 0..=b_len {
        matrix[0][j] = j;
    }

    for i in 1..=a_len {
        for j in 1..=b_len {
            let cost = if a_chars[i - 1] == b_chars[j - 1] {
                0
            } else {
                1
            };
            matrix[i][j] = (matrix[i - 1][j] + 1)
                .min(matrix[i][j - 1] + 1)
                .min(matrix[i - 1][j - 1] + cost);
        }
    }
    matrix[a_len][b_len]
}

/// Check if fuzzy match (allow small errors for longer strings).
/// e.g., "Parkpläzze" vs "Parkplätze" = distance 2, length 10 = 20% error = OK
fn is_fuzzy_match(input: &str, expected: &str) -> bool {
    let distance = levenshtein(input, expected);
    let max_len = input.len().max(expected.len());
    if max_len == 0 {
        return true;
    }

    // Allow up to 20% error rate, minimum 1 char for short words, max 2 chars total
    let max_distance = (max_len / 5).max(1).min(2);
    distance <= max_distance
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize() {
        assert_eq!(normalize("  Hello World  "), "hello world");
        assert_eq!(normalize("Test!@#$123"), "test123");
    }

    #[test]
    fn test_normalize_no_spaces() {
        assert_eq!(normalize_no_spaces("Hello World"), "helloworld");
        assert_eq!(normalize_no_spaces("da lassen"), "dalassen");
    }

    #[test]
    fn test_levenshtein() {
        assert_eq!(levenshtein("", ""), 0);
        assert_eq!(levenshtein("abc", ""), 3);
        assert_eq!(levenshtein("", "abc"), 3);
        assert_eq!(levenshtein("abc", "abc"), 0);
        assert_eq!(levenshtein("abc", "abd"), 1);
        // "Parkpläzze" vs "Parkplätze" - only 'z' vs 't' at position 8
        assert_eq!(levenshtein("Parkpläzze", "Parkplätze"), 1);
        // Two character difference
        assert_eq!(levenshtein("kitten", "sitting"), 3);
    }

    #[test]
    fn test_is_fuzzy_match() {
        // Exact match
        assert!(is_fuzzy_match("hello", "hello"));

        // Small error in longer word
        assert!(is_fuzzy_match("Parkpläzze", "Parkplätze")); // distance 1, len 10

        // Too many errors
        assert!(!is_fuzzy_match("abc", "xyz"));
    }

    #[test]
    fn test_is_answer_match() {
        // Exact match
        assert!(is_answer_match("Hello", "hello", false));

        // Compound words
        assert!(is_answer_match("da lassen", "dalassen", false));

        // Fuzzy match
        assert!(is_answer_match("Parkpläzze", "Parkplätze", true));
        assert!(!is_answer_match("Parkpläzze", "Parkplätze", false));
    }
}
