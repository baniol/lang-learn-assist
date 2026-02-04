//! Type definitions for LLM API interactions.
//!
//! This module contains request/response types for OpenAI and Anthropic APIs,
//! as well as application-specific types for LLM operations.

use serde::{Deserialize, Serialize};

/// Progress event for material processing
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialProcessingProgress {
    pub material_id: i64,
    pub current_chunk: usize,
    pub total_chunks: usize,
    pub percent: f32,
}

/// Token estimation result
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenEstimate {
    pub estimated_tokens: usize,
    pub chunk_count: usize,
    pub estimated_cost_usd: f64,
}

/// Response from LLM API
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmResponse {
    pub content: String,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
}

// ========== OpenAI API Structures ==========

#[derive(Deserialize)]
pub struct OpenAiResponse {
    pub choices: Vec<OpenAiChoice>,
    pub usage: Option<OpenAiUsage>,
}

#[derive(Deserialize)]
pub struct OpenAiChoice {
    pub message: OpenAiMessage,
}

#[derive(Deserialize)]
pub struct OpenAiMessage {
    pub content: Option<String>,
}

#[derive(Deserialize)]
pub struct OpenAiUsage {
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
}

#[derive(Deserialize)]
pub struct OpenAiError {
    pub error: Option<OpenAiErrorDetail>,
}

#[derive(Deserialize)]
pub struct OpenAiErrorDetail {
    pub message: Option<String>,
}

// ========== Anthropic API Structures ==========

#[derive(Deserialize)]
pub struct AnthropicResponse {
    pub content: Vec<AnthropicContent>,
    pub usage: Option<AnthropicUsage>,
}

#[derive(Deserialize)]
pub struct AnthropicContent {
    pub text: Option<String>,
}

#[derive(Deserialize)]
pub struct AnthropicUsage {
    pub input_tokens: i64,
    pub output_tokens: i64,
}

#[derive(Deserialize)]
pub struct AnthropicError {
    pub error: Option<AnthropicErrorDetail>,
}

#[derive(Deserialize)]
pub struct AnthropicErrorDetail {
    pub message: Option<String>,
}
