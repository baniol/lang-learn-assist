//! LLM API client implementations.
//!
//! This module provides HTTP client functions for calling OpenAI and Anthropic APIs.

use crate::constants::llm::REQUEST_TIMEOUT_SECS;
use crate::models::AppSettings;
use std::time::Duration;

use super::types::{
    AnthropicError, AnthropicResponse, LlmResponse, OpenAiError, OpenAiResponse,
};

/// Call OpenAI API
pub async fn call_openai(
    api_key: &str,
    model: &str,
    messages: &[serde_json::Value],
    system_prompt: Option<&str>,
    max_tokens: i64,
) -> Result<LlmResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
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

/// Call Anthropic API
pub async fn call_anthropic(
    api_key: &str,
    model: &str,
    messages: &[serde_json::Value],
    system_prompt: Option<&str>,
    max_tokens: i64,
) -> Result<LlmResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
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

/// Call the configured LLM provider
pub async fn call_llm(
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
