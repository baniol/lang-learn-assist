use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
pub struct SuggestedPhrase {
    pub phrase: String,
    pub translation: String,
    #[serde(default)]
    pub context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuestionResponse {
    pub explanation: String,
    pub phrases: Vec<SuggestedPhrase>,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
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
struct OpenAiErrorResponse {
    error: Option<OpenAiErrorDetail>,
}

#[derive(Deserialize)]
struct OpenAiErrorDetail {
    message: Option<String>,
}

fn build_system_prompt(source_language: &str, target_language: &str) -> String {
    format!(
        r#"You are a language learning assistant helping a {source} speaker learn {target}.

When the user asks a question about vocabulary, grammar, or translations:
1. Provide a brief, helpful explanation
2. Include useful phrases they can learn

ALWAYS respond with valid JSON in this exact format:
{{
  "explanation": "Your helpful explanation here",
  "phrases": [
    {{
      "phrase": "The {target} phrase",
      "translation": "The {source} translation",
      "context": "When/how to use this phrase (optional)"
    }}
  ]
}}

Rules:
- Keep explanations concise but informative
- Include 1-5 relevant phrases per response
- Phrases should be practical and commonly used
- Match the difficulty to the question's context
- The "phrase" field must be in {target}
- The "translation" field must be in {source}"#,
        source = source_language,
        target = target_language
    )
}

pub async fn ask_question(
    api_key: &str,
    question: &str,
    source_language: &str,
    target_language: &str,
) -> Result<QuestionResponse, AppError> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to create HTTP client: {}", e)))?;

    let system_prompt = build_system_prompt(source_language, target_language);

    let body = serde_json::json!({
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question}
        ],
        "max_tokens": 1000,
        "temperature": 0.7
    });

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("OpenAI request failed: {}", e)))?;

    if !response.status().is_success() {
        let error: OpenAiErrorResponse = response.json().await.unwrap_or(OpenAiErrorResponse { error: None });
        let message = error
            .error
            .and_then(|e| e.message)
            .unwrap_or_else(|| "Unknown error".to_string());
        return Err(AppError::Internal(format!("OpenAI API error: {}", message)));
    }

    let data: OpenAiResponse = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse OpenAI response: {}", e)))?;

    let content = data
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .ok_or_else(|| AppError::Internal("Empty response from OpenAI".to_string()))?;

    // Parse JSON from response (handle potential markdown code blocks)
    let json_content = extract_json(&content)?;

    let response: QuestionResponse = serde_json::from_str(&json_content)
        .map_err(|e| AppError::Internal(format!("Failed to parse LLM JSON: {}. Raw: {}", e, content)))?;

    Ok(response)
}

fn extract_json(content: &str) -> Result<String, AppError> {
    // Try to find JSON in markdown code block first
    if let Some(start) = content.find("```json") {
        let after_marker = &content[start + 7..];
        if let Some(end) = after_marker.find("```") {
            return Ok(after_marker[..end].trim().to_string());
        }
    }

    // Try to find JSON in generic code block
    if let Some(start) = content.find("```") {
        let after_marker = &content[start + 3..];
        // Skip language identifier if present
        let json_start = after_marker.find('\n').map(|i| i + 1).unwrap_or(0);
        if let Some(end) = after_marker[json_start..].find("```") {
            return Ok(after_marker[json_start..json_start + end].trim().to_string());
        }
    }

    // Try to find raw JSON object
    let json_start = content.find('{');
    let json_end = content.rfind('}');

    match (json_start, json_end) {
        (Some(start), Some(end)) if end >= start => {
            Ok(content[start..=end].to_string())
        }
        _ => Err(AppError::Internal("No JSON found in response".to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_json_raw() {
        let content = r#"{"explanation": "test", "phrases": []}"#;
        let result = extract_json(content).unwrap();
        assert_eq!(result, content);
    }

    #[test]
    fn test_extract_json_markdown() {
        let content = r#"Here's the response:
```json
{"explanation": "test", "phrases": []}
```"#;
        let result = extract_json(content).unwrap();
        assert_eq!(result, r#"{"explanation": "test", "phrases": []}"#);
    }

    #[test]
    fn test_extract_json_with_text() {
        let content = r#"Sure! Here's your answer: {"explanation": "test", "phrases": []} Hope this helps!"#;
        let result = extract_json(content).unwrap();
        assert_eq!(result, r#"{"explanation": "test", "phrases": []}"#);
    }
}
