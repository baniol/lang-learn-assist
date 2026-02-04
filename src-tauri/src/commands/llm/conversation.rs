//! Conversation-related LLM commands.
//!
//! This module contains Tauri commands for conversation translation,
//! cleanup suggestions, phrase extraction, and LLM connection testing.

use crate::constants::llm::{
    CLEANUP_MAX_TOKENS, CONVERSATION_MAX_TOKENS, EXTRACT_PHRASES_MAX_TOKENS,
    TEST_CONNECTION_MAX_TOKENS,
};
use crate::models::{
    get_language_name, ChatMessage, ConversationCleanupResult, SuggestedPhrase,
};
use crate::state::AppState;
use crate::utils::lock::SafeRwLock;
use serde::Deserialize;
use tauri::State;

use super::client::call_llm;
use super::prompts::build_conversation_system_prompt;
use super::types::LlmResponse;

/// Send a message in a conversation and get a translation response.
#[tauri::command]
pub async fn send_conversation_message(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    subject: String,
    target_language: String,
    native_language: String,
) -> Result<LlmResponse, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    let system_prompt =
        build_conversation_system_prompt(&subject, &target_language, &native_language);

    // Convert ChatMessages to LLM format
    let llm_messages: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            let role = if m.role == "user" { "user" } else { "assistant" };
            serde_json::json!({"role": role, "content": m.content})
        })
        .collect();

    call_llm(&settings, &llm_messages, Some(&system_prompt), CONVERSATION_MAX_TOKENS).await
}

/// Suggest cleanup for a conversation, including cleaned messages and extracted phrases.
#[tauri::command]
pub async fn suggest_conversation_cleanup(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    target_language: String,
    native_language: String,
) -> Result<ConversationCleanupResult, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    let target_name = get_language_name(&target_language);
    let native_name = get_language_name(&native_language);

    let conversation_text = messages
        .iter()
        .map(|m| format!("{}: {}", m.role.to_uppercase(), m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        r#"Analyze this {} learning conversation and provide:
1. A cleaned final conversation containing only the accepted {} phrases
2. A suggested title in {} language
3. Useful phrases for the student to learn

Conversation (user messages are requests in {}, assistant messages are {} phrase suggestions):
---
{}
---

Respond ONLY with valid JSON in this exact format:
{{
  "title": "Short descriptive title in {}",
  "cleanedMessages": [
    {{"id": "unique-id", "role": "assistant", "content": "{} phrase text"}}
  ],
  "suggestedPhrases": [
    {{"prompt": "{} translation", "answer": "{} phrase", "accepted": ["alternative forms"]}}
  ]
}}

Rules for cleanedMessages:
- Only include {} phrases from assistant messages (no user requests)

Rules for suggestedPhrases - VERY IMPORTANT:
- Create SHORT but COMPLETE sentences (5-12 words) - never single words or fragments
- Every phrase MUST be a grammatically complete, standalone sentence
- DO NOT copy long sentences verbatim - simplify them
- Transform complex sentences into simple, reusable model sentences
- "prompt" is the {} translation, "answer" is the {} phrase
- Include 5-10 phrases

CORRECT examples (complete sentences):
- "Ich möchte einen Tisch reservieren."
- "Können Sie mir helfen?"
- "Die Rechnung, bitte."
- "Wo ist die Toilette?"

WRONG examples (incomplete - DO NOT do this):
- "die Speisekarte" (just a word)
- "einen Tisch reservieren" (no subject)
- "helfen könnten" (fragment)"#,
        target_name,
        target_name,
        native_name,
        native_name,
        target_name,
        conversation_text,
        native_name,
        target_name,
        native_name,
        target_name,
        target_name,
        native_name,
        target_name
    );

    let llm_messages = vec![serde_json::json!({"role": "user", "content": prompt})];

    let response = call_llm(&settings, &llm_messages, None, CLEANUP_MAX_TOKENS).await?;

    // Parse the JSON response
    let json_start = response.content.find('{');
    let json_end = response.content.rfind('}');

    let (json_start, json_end) = match (json_start, json_end) {
        (Some(start), Some(end)) if end >= start => (start, end),
        _ => return Err("Failed to parse LLM response as JSON".to_string()),
    };

    let json_str = &response.content[json_start..=json_end];

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct ParsedResponse {
        title: String,
        cleaned_messages: Vec<ChatMessage>,
        suggested_phrases: Vec<SuggestedPhrase>,
    }

    let parsed: ParsedResponse =
        serde_json::from_str(json_str).map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(ConversationCleanupResult {
        title: parsed.title,
        cleaned_messages: parsed.cleaned_messages,
        suggested_phrases: parsed.suggested_phrases,
    })
}

/// Extract learnable phrases from a conversation.
#[tauri::command]
pub async fn extract_phrases_from_conversation(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    target_language: String,
    native_language: String,
) -> Result<Vec<SuggestedPhrase>, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    let target_name = get_language_name(&target_language);
    let native_name = get_language_name(&native_language);

    let conversation_text = messages
        .iter()
        .map(|m| format!("{}: {}", m.role.to_uppercase(), m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        r#"Extract useful {} vocabulary and phrases from this conversation for a {} speaker to learn.

Conversation:
---
{}
---

Respond ONLY with valid JSON array:
[
  {{"prompt": "{} translation", "answer": "{} phrase", "accepted": ["alternative forms"]}}
]

IMPORTANT Rules for phrase extraction:
- Create SHORT but COMPLETE sentences (5-12 words) - never single words or fragments
- Every phrase MUST be a grammatically complete, standalone sentence
- DO NOT copy long sentences verbatim - simplify them
- Transform complex sentences into simple, reusable model sentences
- "prompt" is the {} translation, "answer" is the {} phrase
- "accepted" includes alternative forms (e.g., formal/informal variants)
- Include 5-15 phrases

CORRECT examples (complete sentences):
- "Ich möchte bestellen."
- "Haben Sie die Speisekarte?"
- "Es tut mir leid."
- "Ich bin zu spät gekommen."

WRONG examples (DO NOT do this):
- "die Speisekarte" (just a noun - NOT a sentence)
- "bestellen" (just a verb - NOT a sentence)
- "zu spät gekommen" (fragment - NOT a sentence)

Transform long sentences:
- "Ich würde gerne wissen, ob Sie mir helfen könnten" → "Können Sie mir helfen?""#,
        target_name,
        native_name,
        conversation_text,
        native_name,
        target_name,
        native_name,
        target_name
    );

    let llm_messages = vec![serde_json::json!({"role": "user", "content": prompt})];

    let response = call_llm(&settings, &llm_messages, None, EXTRACT_PHRASES_MAX_TOKENS).await?;

    // Parse the JSON response
    let json_start = response.content.find('[');
    let json_end = response.content.rfind(']');

    let (json_start, json_end) = match (json_start, json_end) {
        (Some(start), Some(end)) if end >= start => (start, end),
        _ => return Err("Failed to parse LLM response as JSON array".to_string()),
    };

    let json_str = &response.content[json_start..=json_end];

    let phrases: Vec<SuggestedPhrase> =
        serde_json::from_str(json_str).map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(phrases)
}

/// Test the LLM connection with a simple request.
#[tauri::command]
pub async fn test_llm_connection(state: State<'_, AppState>) -> Result<String, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    let test_messages = vec![serde_json::json!({"role": "user", "content": "Say hello in one word."})];

    let response = call_llm(&settings, &test_messages, None, TEST_CONNECTION_MAX_TOKENS).await?;

    Ok(format!(
        "Connection successful! Response: {}",
        response.content
    ))
}
