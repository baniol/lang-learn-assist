//! Phrase translation LLM commands.
//!
//! This module contains Tauri commands for translating phrases to different
//! target languages using AI.

use crate::constants::llm::TRANSLATE_PHRASE_MAX_TOKENS;
use crate::db::get_conn;
use crate::models::{Phrase, TranslationPreview};
use crate::state::AppState;
use crate::utils::db::row_to_phrase;
use crate::utils::lock::SafeRwLock;
use rusqlite::params;
use serde::Deserialize;
use tauri::State;

use super::client::call_llm;
use super::prompts::build_translation_system_prompt;

/// Preview a phrase translation to a new target language.
#[tauri::command]
#[allow(non_snake_case)]
pub async fn preview_phrase_translation(
    state: State<'_, AppState>,
    phraseId: i64,
    newTargetLanguage: String,
) -> Result<TranslationPreview, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    // Get the phrase from database
    let conn = get_conn()?;
    let phrase: Phrase = conn
        .query_row(
            "SELECT id, prompt, answer, accepted_json, target_language, native_language,
                    audio_path, notes, starred, excluded, created_at, material_id, deck_id, refined
             FROM phrases WHERE id = ?1",
            params![phraseId],
            row_to_phrase,
        )
        .map_err(|e| format!("Phrase not found: {}", e))?;

    // Build the prompt with phrase content
    let system_prompt = build_translation_system_prompt(
        &phrase.target_language,
        &newTargetLanguage,
        &phrase.native_language,
    );

    // Format accepted as a list for the prompt
    let accepted_list = if phrase.accepted.is_empty() {
        "(no alternatives)".to_string()
    } else {
        phrase.accepted.join(", ")
    };

    let user_message = format!(
        "Please translate the following phrase:\n\nAnswer: {}\nAccepted alternatives: {}",
        phrase.answer, accepted_list
    );

    let llm_messages = vec![serde_json::json!({"role": "user", "content": user_message})];

    let response = call_llm(
        &settings,
        &llm_messages,
        Some(&system_prompt),
        TRANSLATE_PHRASE_MAX_TOKENS,
    )
    .await?;

    // Parse the JSON response
    let json_start = response.content.find('{');
    let json_end = response.content.rfind('}');

    let (json_start, json_end) = match (json_start, json_end) {
        (Some(start), Some(end)) if end >= start => (start, end),
        _ => {
            return Err(format!(
                "Failed to parse translation response: no JSON found in: {}",
                response.content
            ));
        }
    };

    let json_str = &response.content[json_start..=json_end];

    #[derive(Deserialize)]
    struct TranslationResponse {
        answer: String,
        #[serde(default)]
        accepted: Vec<String>,
    }

    let parsed: TranslationResponse = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse translation: {}. Raw: {}", e, json_str))?;

    Ok(TranslationPreview {
        phrase_id: phraseId,
        original_answer: phrase.answer,
        translated_answer: parsed.answer,
        original_accepted: phrase.accepted,
        translated_accepted: parsed.accepted,
        new_target_language: newTargetLanguage,
    })
}

/// Apply a phrase translation by creating a new phrase in the target language.
/// The original phrase remains unchanged.
#[tauri::command]
#[allow(non_snake_case)]
pub fn apply_phrase_translation(
    phraseId: i64,
    translatedAnswer: String,
    translatedAccepted: Vec<String>,
    newTargetLanguage: String,
) -> Result<Phrase, String> {
    let conn = get_conn()?;

    // Get the original phrase to copy its prompt, native_language, notes, material_id
    let original: Phrase = conn
        .query_row(
            "SELECT id, prompt, answer, accepted_json, target_language, native_language,
                    audio_path, notes, starred, excluded, created_at, material_id, deck_id, refined
             FROM phrases WHERE id = ?1",
            params![phraseId],
            row_to_phrase,
        )
        .map_err(|e| format!("Original phrase not found: {}", e))?;

    let accepted_json = serde_json::to_string(&translatedAccepted)
        .map_err(|e| format!("Failed to serialize accepted: {}", e))?;

    // Create a new phrase with the translated content
    conn.execute(
        "INSERT INTO phrases (prompt, answer, accepted_json, target_language, native_language,
                              notes, material_id, starred, excluded, refined)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            original.prompt,
            translatedAnswer,
            accepted_json,
            newTargetLanguage,
            original.native_language,
            original.notes,
            original.material_id,
            false, // not starred by default
            false, // not excluded
            false, // not refined
        ],
    )
    .map_err(|e| format!("Failed to create translated phrase: {}", e))?;

    let new_id = conn.last_insert_rowid();

    // Return the new phrase
    conn.query_row(
        "SELECT id, prompt, answer, accepted_json, target_language, native_language,
                audio_path, notes, starred, excluded, created_at, material_id, deck_id, refined
         FROM phrases WHERE id = ?1",
        params![new_id],
        row_to_phrase,
    )
    .map_err(|e| format!("Failed to retrieve new phrase: {}", e))
}
