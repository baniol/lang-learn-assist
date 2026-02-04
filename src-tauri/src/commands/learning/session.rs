//! Practice session management.
//!
//! This module handles creating, updating, and managing practice sessions,
//! including session state persistence and progress reset functionality.

use crate::db::get_conn;
use crate::models::{PracticeSession, SessionState};
use rusqlite::params;

/// Start a new practice session.
#[tauri::command]
pub fn start_practice_session(exercise_mode: String) -> Result<PracticeSession, String> {
    let conn = get_conn()?;

    conn.execute(
        "INSERT INTO practice_sessions (exercise_mode) VALUES (?1)",
        params![exercise_mode],
    )
    .map_err(|e| format!("Failed to create session: {}", e))?;

    let id = conn.last_insert_rowid();

    get_session_by_id(&conn, id)
}

/// Update practice session counts.
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

/// Finish a practice session.
#[tauri::command]
pub fn finish_practice_session(session_id: i64) -> Result<PracticeSession, String> {
    let conn = get_conn()?;

    // Clear state and set finished_at
    conn.execute(
        "UPDATE practice_sessions SET finished_at = datetime('now'), state_json = NULL WHERE id = ?1",
        params![session_id],
    )
    .map_err(|e| format!("Failed to finish session: {}", e))?;

    get_session_by_id(&conn, session_id)
}

/// Save session state for persistence across app restarts.
#[tauri::command]
pub fn save_session_state(session_id: i64, state: SessionState) -> Result<(), String> {
    let conn = get_conn()?;

    let state_json =
        serde_json::to_string(&state).map_err(|e| format!("Failed to serialize state: {}", e))?;

    conn.execute(
        "UPDATE practice_sessions SET state_json = ?1 WHERE id = ?2",
        params![state_json, session_id],
    )
    .map_err(|e| format!("Failed to save session state: {}", e))?;

    Ok(())
}

/// Get the currently active (unfinished) session.
#[tauri::command]
pub fn get_active_session(
    _target_language: Option<String>,
) -> Result<Option<PracticeSession>, String> {
    let conn = get_conn()?;

    // Get the most recent unfinished session
    let result = conn.query_row(
        "SELECT id, started_at, finished_at, total_phrases, correct_answers, exercise_mode, state_json
         FROM practice_sessions
         WHERE finished_at IS NULL
         ORDER BY started_at DESC
         LIMIT 1",
        [],
        parse_session_row,
    );

    match result {
        Ok(session) => Ok(Some(session)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get active session: {}", e)),
    }
}

/// Get recent practice sessions.
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
        .query_map(params![limit], parse_session_row)
        .map_err(|e| format!("Failed to query sessions: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect sessions: {}", e))?;

    Ok(sessions)
}

/// Reset phrases in learning state to be due now.
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

/// Reset progress for a specific phrase or all phrases.
#[tauri::command]
pub fn reset_progress(phrase_id: Option<i64>) -> Result<(), String> {
    let conn = get_conn()?;

    if let Some(id) = phrase_id {
        conn.execute(
            "DELETE FROM phrase_progress WHERE phrase_id = ?1",
            params![id],
        )
        .map_err(|e| format!("Failed to reset progress: {}", e))?;
    } else {
        conn.execute("DELETE FROM phrase_progress", [])
            .map_err(|e| format!("Failed to reset all progress: {}", e))?;
    }

    Ok(())
}

/// Helper to get a session by ID.
fn get_session_by_id(
    conn: &rusqlite::Connection,
    id: i64,
) -> Result<PracticeSession, String> {
    conn.query_row(
        "SELECT id, started_at, finished_at, total_phrases, correct_answers, exercise_mode, state_json
         FROM practice_sessions WHERE id = ?1",
        params![id],
        parse_session_row,
    )
    .map_err(|e| format!("Failed to get session: {}", e))
}

/// Helper to parse a session row.
fn parse_session_row(row: &rusqlite::Row) -> Result<PracticeSession, rusqlite::Error> {
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
}
