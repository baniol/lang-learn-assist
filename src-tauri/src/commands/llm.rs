use crate::models::{AppSettings, ChatMessage, ConversationCleanupResult, SuggestedPhrase};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmResponse {
    pub content: String,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
}

// OpenAI API structures
#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
    usage: Option<OpenAiUsage>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
}

#[derive(Deserialize)]
struct OpenAiMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct OpenAiUsage {
    prompt_tokens: i64,
    completion_tokens: i64,
}

#[derive(Deserialize)]
struct OpenAiError {
    error: Option<OpenAiErrorDetail>,
}

#[derive(Deserialize)]
struct OpenAiErrorDetail {
    message: Option<String>,
}

// Anthropic API structures
#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
    usage: Option<AnthropicUsage>,
}

#[derive(Deserialize)]
struct AnthropicContent {
    text: Option<String>,
}

#[derive(Deserialize)]
struct AnthropicUsage {
    input_tokens: i64,
    output_tokens: i64,
}

#[derive(Deserialize)]
struct AnthropicError {
    error: Option<AnthropicErrorDetail>,
}

#[derive(Deserialize)]
struct AnthropicErrorDetail {
    message: Option<String>,
}

async fn call_openai(
    api_key: &str,
    model: &str,
    messages: &[serde_json::Value],
    system_prompt: Option<&str>,
    max_tokens: i64,
) -> Result<LlmResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut all_messages = Vec::new();
    if let Some(system) = system_prompt {
        all_messages.push(serde_json::json!({"role": "system", "content": system}));
    }
    all_messages.extend(messages.iter().cloned());

    let body = serde_json::json!({
        "model": model,
        "messages": all_messages,
        "max_tokens": max_tokens,
        "temperature": 0.7
    });

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    if !response.status().is_success() {
        let error: OpenAiError = response.json().await.unwrap_or(OpenAiError { error: None });
        let message = error
            .error
            .and_then(|e| e.message)
            .unwrap_or_else(|| "Unknown error".to_string());
        return Err(format!("OpenAI API error: {}", message));
    }

    let data: OpenAiResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

    let content = data
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default();

    let (input_tokens, output_tokens) = data
        .usage
        .map(|u| (Some(u.prompt_tokens), Some(u.completion_tokens)))
        .unwrap_or((None, None));

    Ok(LlmResponse {
        content,
        input_tokens,
        output_tokens,
    })
}

async fn call_anthropic(
    api_key: &str,
    model: &str,
    messages: &[serde_json::Value],
    system_prompt: Option<&str>,
    max_tokens: i64,
) -> Result<LlmResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": messages
    });

    if let Some(system) = system_prompt {
        body["system"] = serde_json::json!(system);
    }

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    if !response.status().is_success() {
        let error: AnthropicError = response
            .json()
            .await
            .unwrap_or(AnthropicError { error: None });
        let message = error
            .error
            .and_then(|e| e.message)
            .unwrap_or_else(|| "Unknown error".to_string());
        return Err(format!("Anthropic API error: {}", message));
    }

    let data: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

    let content = data
        .content
        .first()
        .and_then(|c| c.text.clone())
        .unwrap_or_default();

    let (input_tokens, output_tokens) = data
        .usage
        .map(|u| (Some(u.input_tokens), Some(u.output_tokens)))
        .unwrap_or((None, None));

    Ok(LlmResponse {
        content,
        input_tokens,
        output_tokens,
    })
}

async fn call_llm(
    settings: &AppSettings,
    messages: &[serde_json::Value],
    system_prompt: Option<&str>,
    max_tokens: i64,
) -> Result<LlmResponse, String> {
    match settings.llm_provider.as_str() {
        "openai" => {
            call_openai(
                &settings.llm_api_key,
                &settings.llm_model,
                messages,
                system_prompt,
                max_tokens,
            )
            .await
        }
        "anthropic" => {
            call_anthropic(
                &settings.llm_api_key,
                &settings.llm_model,
                messages,
                system_prompt,
                max_tokens,
            )
            .await
        }
        _ => Err(format!("Unknown LLM provider: {}", settings.llm_provider)),
    }
}

fn build_conversation_system_prompt(subject: &str, target_lang: &str, native_lang: &str) -> String {
    let target_name = match target_lang {
        "de" => "German",
        "en" => "English",
        "fr" => "French",
        "es" => "Spanish",
        "it" => "Italian",
        _ => target_lang,
    };

    let native_name = match native_lang {
        "pl" => "Polish",
        "en" => "English",
        "de" => "German",
        _ => native_lang,
    };

    format!(
        r#"You are a {} language tutor having a conversation with a {}-speaking student.
Topic: {}

Guidelines:
- Respond in {} at B1-B2 level
- Keep responses short (2-3 sentences)
- Use practical, everyday vocabulary
- When student writes [META] followed by {}, answer in {} about {}, then continue the conversation
- If the student makes grammatical errors, gently correct them
- Suggest useful phrases the student might want to use"#,
        target_name, native_name, subject, target_name, native_name, native_name, target_name
    )
}

#[tauri::command]
pub async fn send_conversation_message(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    subject: String,
    target_language: String,
    native_language: String,
) -> Result<LlmResponse, String> {
    let settings = {
        let guard = state
            .settings
            .lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        guard.clone()
    };

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    let system_prompt =
        build_conversation_system_prompt(&subject, &target_language, &native_language);

    // Convert ChatMessages to LLM format
    let llm_messages: Vec<serde_json::Value> = messages
        .iter()
        .filter(|m| m.role != "meta")
        .map(|m| {
            let role = if m.role == "user" { "user" } else { "assistant" };
            serde_json::json!({"role": role, "content": m.content})
        })
        .collect();

    call_llm(&settings, &llm_messages, Some(&system_prompt), 500).await
}

#[tauri::command]
pub async fn suggest_conversation_cleanup(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    target_language: String,
    native_language: String,
) -> Result<ConversationCleanupResult, String> {
    let settings = {
        let guard = state
            .settings
            .lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        guard.clone()
    };

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    let target_name = match target_language.as_str() {
        "de" => "German",
        "en" => "English",
        "fr" => "French",
        "es" => "Spanish",
        "it" => "Italian",
        _ => &target_language,
    };

    let native_name = match native_language.as_str() {
        "pl" => "Polish",
        "en" => "English",
        "de" => "German",
        _ => &native_language,
    };

    let conversation_text = messages
        .iter()
        .map(|m| format!("{}: {}", m.role.to_uppercase(), m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        r#"Analyze this {} learning conversation and provide:
1. A cleaned version removing meta-questions (marked with [META])
2. A suggested title
3. Useful phrases for the student to learn

Conversation:
---
{}
---

Respond ONLY with valid JSON in this exact format:
{{
  "title": "Short descriptive title",
  "cleanedMessages": [
    {{"id": "unique-id", "role": "user|assistant", "content": "message text", "isMetaQuestion": false}}
  ],
  "suggestedPhrases": [
    {{"prompt": "{} translation", "answer": "{} phrase", "accepted": ["alternative spellings"]}}
  ]
}}

Rules:
- Remove all [META] questions and their responses from cleanedMessages
- Extract 5-10 most useful phrases from the conversation
- Phrases should be practical vocabulary the student used or should learn
- "prompt" is in {} (native), "answer" is in {} (target)"#,
        target_name,
        conversation_text,
        native_name,
        target_name,
        native_name,
        target_name
    );

    let llm_messages = vec![serde_json::json!({"role": "user", "content": prompt})];

    let response = call_llm(&settings, &llm_messages, None, 2000).await?;

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

#[tauri::command]
pub async fn extract_phrases_from_conversation(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    target_language: String,
    native_language: String,
) -> Result<Vec<SuggestedPhrase>, String> {
    let settings = {
        let guard = state
            .settings
            .lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        guard.clone()
    };

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    let target_name = match target_language.as_str() {
        "de" => "German",
        _ => &target_language,
    };

    let native_name = match native_language.as_str() {
        "pl" => "Polish",
        _ => &native_language,
    };

    let conversation_text = messages
        .iter()
        .map(|m| format!("{}: {}", m.role.to_uppercase(), m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        r#"Extract useful {} phrases from this conversation for a {} speaker to learn.

Conversation:
---
{}
---

Respond ONLY with valid JSON array:
[
  {{"prompt": "{} translation", "answer": "{} phrase", "accepted": ["alternative spellings"]}}
]

Rules:
- Extract 5-15 most useful, practical phrases
- Include phrases the student used and important phrases from the tutor
- "prompt" is the {} translation, "answer" is the {} original
- "accepted" includes common alternative spellings or forms"#,
        target_name,
        native_name,
        conversation_text,
        native_name,
        target_name,
        native_name,
        target_name
    );

    let llm_messages = vec![serde_json::json!({"role": "user", "content": prompt})];

    let response = call_llm(&settings, &llm_messages, None, 1500).await?;

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

#[tauri::command]
pub async fn test_llm_connection(state: State<'_, AppState>) -> Result<String, String> {
    let settings = {
        let guard = state
            .settings
            .lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        guard.clone()
    };

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    let test_messages = vec![serde_json::json!({"role": "user", "content": "Say hello in one word."})];

    let response = call_llm(&settings, &test_messages, None, 50).await?;

    Ok(format!(
        "Connection successful! Response: {}",
        response.content
    ))
}
