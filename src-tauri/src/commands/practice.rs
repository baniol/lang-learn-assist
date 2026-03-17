//! Practice session commands for conversational practice with materials.
//!
//! Provides CRUD for practice sessions and LLM-powered conversation.

use crate::constants::practice::{MATERIAL_CONTEXT_MAX_TOKENS, PRACTICE_RESPONSE_MAX_TOKENS};
use crate::constants::tokens::CHARS_PER_TOKEN_GERMAN;
use crate::db::get_conn;
use crate::models::{
    PracticeMessage, PracticeResponse, PracticeSession, SuggestedPhrase, TextSegment,
};
use crate::state::AppState;
use crate::utils::lock::SafeRwLock;
use rusqlite::params;
use tauri::State;

use super::llm::client::call_llm;
use super::llm::prompts::{
    build_practice_exercise_system_prompt, build_practice_free_system_prompt,
};

/// Build a context string from material segments, truncated to fit within token budget.
fn build_material_context(segments: &[TextSegment], max_tokens: usize) -> String {
    let max_chars = max_tokens * CHARS_PER_TOKEN_GERMAN;
    let mut context = String::new();

    for seg in segments {
        let line = format!("{} ({})\n", seg.text, seg.translation);
        if context.len() + line.len() > max_chars {
            context.push_str("...\n");
            break;
        }
        context.push_str(&line);
    }

    context
}

/// Get all practice sessions for a material.
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_practice_sessions(materialId: i64) -> Result<Vec<PracticeSession>, String> {
    let conn = get_conn()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, material_id, mode, messages_json, suggested_phrases_json, created_at, updated_at
             FROM practice_sessions WHERE material_id = ?1 ORDER BY updated_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let sessions = stmt
        .query_map(params![materialId], |row| {
            let messages_json: String = row.get(3)?;
            let phrases_json: Option<String> = row.get(4)?;
            Ok(PracticeSession {
                id: row.get(0)?,
                material_id: row.get(1)?,
                mode: row.get(2)?,
                messages: serde_json::from_str(&messages_json).unwrap_or_default(),
                suggested_phrases: phrases_json.and_then(|j| serde_json::from_str(&j).ok()),
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Collection failed: {}", e))?;

    Ok(sessions)
}

/// Create a new practice session.
#[tauri::command]
#[allow(non_snake_case)]
pub fn create_practice_session(materialId: i64, mode: String) -> Result<PracticeSession, String> {
    let conn = get_conn()?;
    conn.execute(
        "INSERT INTO practice_sessions (material_id, mode) VALUES (?1, ?2)",
        params![materialId, mode],
    )
    .map_err(|e| format!("Failed to create session: {}", e))?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn
        .prepare(
            "SELECT id, material_id, mode, messages_json, suggested_phrases_json, created_at, updated_at
             FROM practice_sessions WHERE id = ?1",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    stmt.query_row(params![id], |row| {
        let messages_json: String = row.get(3)?;
        let phrases_json: Option<String> = row.get(4)?;
        Ok(PracticeSession {
            id: row.get(0)?,
            material_id: row.get(1)?,
            mode: row.get(2)?,
            messages: serde_json::from_str(&messages_json).unwrap_or_default(),
            suggested_phrases: phrases_json.and_then(|j| serde_json::from_str(&j).ok()),
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })
    .map_err(|e| format!("Failed to fetch created session: {}", e))
}

/// Update a practice session's messages and suggested phrases.
#[tauri::command]
#[allow(non_snake_case)]
pub fn update_practice_session(
    id: i64,
    messages: Vec<PracticeMessage>,
    suggestedPhrases: Option<Vec<SuggestedPhrase>>,
) -> Result<PracticeSession, String> {
    let conn = get_conn()?;
    let messages_json = serde_json::to_string(&messages)
        .map_err(|e| format!("Failed to serialize messages: {}", e))?;
    let phrases_json = suggestedPhrases
        .as_ref()
        .map(|p| {
            serde_json::to_string(p).map_err(|e| format!("Failed to serialize phrases: {}", e))
        })
        .transpose()?;

    conn.execute(
        "UPDATE practice_sessions SET messages_json = ?1, suggested_phrases_json = ?2, updated_at = datetime('now') WHERE id = ?3",
        params![messages_json, phrases_json, id],
    )
    .map_err(|e| format!("Failed to update session: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, material_id, mode, messages_json, suggested_phrases_json, created_at, updated_at
             FROM practice_sessions WHERE id = ?1",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    stmt.query_row(params![id], |row| {
        let messages_json: String = row.get(3)?;
        let phrases_json: Option<String> = row.get(4)?;
        Ok(PracticeSession {
            id: row.get(0)?,
            material_id: row.get(1)?,
            mode: row.get(2)?,
            messages: serde_json::from_str(&messages_json).unwrap_or_default(),
            suggested_phrases: phrases_json.and_then(|j| serde_json::from_str(&j).ok()),
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })
    .map_err(|e| format!("Failed to fetch updated session: {}", e))
}

/// Delete a practice session.
#[tauri::command]
pub fn delete_practice_session(id: i64) -> Result<(), String> {
    let conn = get_conn()?;
    conn.execute("DELETE FROM practice_sessions WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete session: {}", e))?;
    Ok(())
}

/// Send a message in a practice session and get LLM response.
#[tauri::command]
#[allow(non_snake_case)]
pub async fn practice_send_message(
    state: State<'_, AppState>,
    materialId: i64,
    mode: String,
    userMessage: String,
    previousMessages: Vec<PracticeMessage>,
    targetLanguage: String,
    nativeLanguage: String,
) -> Result<PracticeResponse, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    // Load material segments from DB
    let segments_json: Option<String> = {
        let conn = get_conn()?;
        conn.query_row(
            "SELECT segments_json FROM materials WHERE id = ?1",
            params![materialId],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to load material: {}", e))?
    };

    let segments: Vec<TextSegment> = segments_json
        .and_then(|j| serde_json::from_str(&j).ok())
        .unwrap_or_default();

    if segments.is_empty() {
        return Err("Material has no processed segments".to_string());
    }

    // Build context from segments
    let material_context = build_material_context(&segments, MATERIAL_CONTEXT_MAX_TOKENS);

    // Build mode-specific system prompt
    let system_prompt = match mode.as_str() {
        "exercise" => build_practice_exercise_system_prompt(
            &material_context,
            &targetLanguage,
            &nativeLanguage,
        ),
        _ => build_practice_free_system_prompt(&material_context, &targetLanguage, &nativeLanguage),
    };

    // Build conversation history (cap at last 20 messages)
    let history_start = if previousMessages.len() > 20 {
        previousMessages.len() - 20
    } else {
        0
    };
    let mut llm_messages: Vec<serde_json::Value> = previousMessages[history_start..]
        .iter()
        .map(|m| {
            let role = if m.role == "user" {
                "user"
            } else {
                "assistant"
            };
            serde_json::json!({"role": role, "content": m.content})
        })
        .collect();

    llm_messages.push(serde_json::json!({"role": "user", "content": userMessage}));

    let response = call_llm(
        &settings,
        &llm_messages,
        Some(&system_prompt),
        PRACTICE_RESPONSE_MAX_TOKENS,
    )
    .await?;

    // Parse JSON response with fallback
    let json_start = response.content.find('{');
    let json_end = response.content.rfind('}');

    match (json_start, json_end) {
        (Some(start), Some(end)) if end >= start => {
            let json_str = &response.content[start..=end];
            match serde_json::from_str::<PracticeResponse>(json_str) {
                Ok(parsed) => Ok(parsed),
                Err(_) => {
                    // Fallback: treat whole content as reply
                    Ok(PracticeResponse {
                        reply: response.content,
                        phrases: vec![],
                        feedback: None,
                    })
                }
            }
        }
        _ => {
            // No JSON found, treat as plain reply
            Ok(PracticeResponse {
                reply: response.content,
                phrases: vec![],
                feedback: None,
            })
        }
    }
}
