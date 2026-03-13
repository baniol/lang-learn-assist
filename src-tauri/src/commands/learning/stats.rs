//! Learning statistics and reset operations.

use crate::db::get_conn;
use crate::models::LearningStats;

/// Get general learning statistics.
///
/// Returns counts of total, learned, learning, and new phrases,
/// along with average success rate and total practice sessions.
#[tauri::command]
pub fn get_learning_stats(target_language: Option<String>) -> Result<LearningStats, String> {
    let conn = get_conn()?;

    // Use parameterized queries for language filter
    let (lang_filter, params): (&str, Vec<&dyn rusqlite::ToSql>) = match &target_language {
        Some(lang) => (
            " AND p.target_language = ?",
            vec![lang as &dyn rusqlite::ToSql],
        ),
        None => ("", vec![]),
    };

    // Total phrases
    let total_phrases: i32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM phrases p WHERE 1=1{}",
                lang_filter
            ),
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

    // Phrases in decks (have deck_id, not yet graduated to SRS)
    let in_decks_count: i32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM phrases p
                 LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
                 WHERE p.deck_id IS NOT NULL
                 AND (pp.in_srs_pool = 0 OR pp.in_srs_pool IS NULL){}",
                lang_filter
            ),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Phrases graduated to SRS (in_srs_pool = 1)
    let graduated_to_srs_count: i32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM phrases p
                 JOIN phrase_progress pp ON p.id = pp.phrase_id
                 WHERE pp.in_srs_pool = 1{}",
                lang_filter
            ),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(LearningStats {
        total_phrases,
        learned_count,
        learning_count,
        new_count,
        average_success_rate,
        total_sessions,
        in_decks_count,
        graduated_to_srs_count,
    })
}

/// Reset all practice sessions (clears session history).
#[tauri::command]
pub fn reset_practice_sessions() -> Result<i32, String> {
    let conn = get_conn()?;
    let deleted = conn
        .execute("DELETE FROM practice_sessions", [])
        .map_err(|e| format!("Failed to delete sessions: {}", e))?;
    Ok(deleted as i32)
}

/// Reset all phrase progress (clears learning history, keeps phrases).
#[tauri::command]
pub fn reset_phrase_progress() -> Result<i32, String> {
    let conn = get_conn()?;
    let updated = conn
        .execute(
            "UPDATE phrase_progress SET
                correct_streak = 0,
                total_attempts = 0,
                success_count = 0,
                last_seen = NULL,
                ease_factor = 2.5,
                interval_days = 0,
                next_review_at = NULL,
                in_srs_pool = 0,
                deck_correct_count = 0,
                learning_status = 'new'",
            [],
        )
        .map_err(|e| format!("Failed to reset progress: {}", e))?;
    Ok(updated as i32)
}
