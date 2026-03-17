//! Phrase refinement and title generation LLM commands.
//!
//! This module contains Tauri commands for refining phrases with AI assistance
//! and generating titles for conversations.

use crate::constants::llm::{
    GENERATE_PHRASES_MAX_TOKENS, REFINE_PHRASE_MAX_TOKENS, TITLE_MAX_TOKENS,
};
use crate::models::{
    get_language_name, AskAboutSentenceResponse, Phrase, PhraseThreadMessage,
    RefinePhraseSuggestion,
};
use crate::state::AppState;
use crate::utils::lock::SafeRwLock;
use serde::Deserialize;
use tauri::State;

use super::client::call_llm;
use super::prompts::{build_phrase_generation_system_prompt, build_refinement_system_prompt};

/// Refine a phrase based on user requests through conversation.
#[tauri::command]
pub async fn refine_phrase(
    state: State<'_, AppState>,
    phrase: Phrase,
    messages: Vec<PhraseThreadMessage>,
    user_message: String,
) -> Result<RefinePhraseSuggestion, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    let system_prompt = build_refinement_system_prompt(&phrase);

    // Convert thread messages to LLM format, then add the new user message
    let mut llm_messages: Vec<serde_json::Value> = messages
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

    llm_messages.push(serde_json::json!({"role": "user", "content": user_message}));

    let response = call_llm(
        &settings,
        &llm_messages,
        Some(&system_prompt),
        REFINE_PHRASE_MAX_TOKENS,
    )
    .await?;

    // Parse the JSON response
    let json_start = response.content.find('{');
    let json_end = response.content.rfind('}');

    let (json_start, json_end) = match (json_start, json_end) {
        (Some(start), Some(end)) if end >= start => (start, end),
        _ => {
            // If no JSON found, treat the whole response as explanation
            return Ok(RefinePhraseSuggestion {
                prompt: None,
                answer: None,
                accepted: None,
                explanation: response.content,
            });
        }
    };

    let json_str = &response.content[json_start..=json_end];

    #[derive(Deserialize)]
    struct ParsedResponse {
        suggestion: RefinePhraseSuggestion,
    }

    let parsed: ParsedResponse = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse response: {}. Raw: {}", e, json_str))?;

    Ok(parsed.suggestion)
}

/// Generate a short, meaningful title from content (conversation or question).
#[tauri::command]
pub async fn generate_title(
    state: State<'_, AppState>,
    content: String,
    content_type: String, // "conversation" or "question"
    native_language: Option<String>,
) -> Result<String, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_provider == "none" || settings.llm_api_key.is_empty() {
        return Err("LLM not configured".to_string());
    }

    let lang = native_language.unwrap_or_else(|| settings.native_language.clone());
    let lang_name = get_language_name(&lang);

    let prompt = format!(
        r#"Generate a very short title (3-6 words max) for this {} content.
The title should capture the main topic or theme.
IMPORTANT: Write the title in {} language.
Respond with ONLY the title, no quotes, no explanation.

Content:
{}

Title:"#,
        content_type, lang_name, content
    );

    let llm_messages = vec![serde_json::json!({"role": "user", "content": prompt})];

    let response = call_llm(&settings, &llm_messages, None, TITLE_MAX_TOKENS).await?;

    // Clean up the response - remove quotes, newlines, etc.
    let title = response
        .content
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .lines()
        .next()
        .unwrap_or("Untitled")
        .to_string();

    Ok(title)
}

/// Generate phrase suggestions based on a user query (e.g. "how to ask for directions").
#[tauri::command]
#[allow(non_snake_case)]
pub async fn generate_phrases(
    state: State<'_, AppState>,
    query: String,
    previousMessages: Vec<serde_json::Value>,
    targetLanguage: Option<String>,
    nativeLanguage: Option<String>,
) -> Result<AskAboutSentenceResponse, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    let target_lang = targetLanguage.unwrap_or_else(|| settings.target_language.clone());
    let native_lang = nativeLanguage.unwrap_or_else(|| settings.native_language.clone());

    let system_prompt = build_phrase_generation_system_prompt(&target_lang, &native_lang);

    let mut llm_messages = previousMessages;
    llm_messages.push(serde_json::json!({"role": "user", "content": query}));

    let response = call_llm(
        &settings,
        &llm_messages,
        Some(&system_prompt),
        GENERATE_PHRASES_MAX_TOKENS,
    )
    .await?;

    let json_start = response.content.find('{');
    let json_end = response.content.rfind('}');

    let (json_start, json_end) = match (json_start, json_end) {
        (Some(start), Some(end)) if end >= start => (start, end),
        _ => {
            return Ok(AskAboutSentenceResponse {
                explanation: response.content,
                phrases: vec![],
            });
        }
    };

    let json_str = &response.content[json_start..=json_end];

    let parsed: AskAboutSentenceResponse = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse response: {}. Raw: {}", e, json_str))?;

    Ok(parsed)
}
