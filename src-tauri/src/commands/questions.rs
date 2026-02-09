use crate::db::get_conn;
use crate::models::{
    get_language_name, AppSettings, GrammarQuestionResponse, QuestionMessage, QuestionThread,
};
use crate::state::AppState;
use crate::utils::lock::SafeRwLock;
use rusqlite::params;
use serde::Deserialize;
use std::time::Duration;
use tauri::State;

fn row_to_question_thread(row: &rusqlite::Row) -> Result<QuestionThread, rusqlite::Error> {
    let messages_json: String = row.get(4)?;
    let messages: Vec<QuestionMessage> = serde_json::from_str(&messages_json).unwrap_or_default();

    Ok(QuestionThread {
        id: row.get(0)?,
        title: row.get(1)?,
        target_language: row.get(2)?,
        native_language: row.get(3)?,
        messages,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

#[tauri::command]
pub fn get_question_threads(target_language: Option<String>) -> Result<Vec<QuestionThread>, String> {
    let conn = get_conn()?;

    let (query, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match target_language {
        Some(ref lang) => (
            "SELECT id, title, target_language, native_language, messages_json, created_at, updated_at
             FROM question_threads
             WHERE target_language = ?1
             ORDER BY updated_at DESC".to_string(),
            vec![Box::new(lang.clone()) as Box<dyn rusqlite::ToSql>],
        ),
        None => (
            "SELECT id, title, target_language, native_language, messages_json, created_at, updated_at
             FROM question_threads
             ORDER BY updated_at DESC".to_string(),
            vec![],
        ),
    };

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let threads = stmt
        .query_map(param_refs.as_slice(), row_to_question_thread)
        .map_err(|e| format!("Failed to query threads: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect threads: {}", e))?;

    Ok(threads)
}

#[tauri::command]
pub fn get_question_thread(id: i64) -> Result<QuestionThread, String> {
    let conn = get_conn()?;

    conn.query_row(
        "SELECT id, title, target_language, native_language, messages_json, created_at, updated_at
         FROM question_threads WHERE id = ?1",
        params![id],
        row_to_question_thread,
    )
    .map_err(|e| format!("Thread not found: {}", e))
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn create_question_thread(
    title: String,
    targetLanguage: Option<String>,
    nativeLanguage: Option<String>,
) -> Result<QuestionThread, String> {
    let conn = get_conn()?;

    let target_lang = targetLanguage.unwrap_or_else(|| "de".to_string());
    let native_lang = nativeLanguage.unwrap_or_else(|| "pl".to_string());

    conn.execute(
        "INSERT INTO question_threads (title, target_language, native_language, messages_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, '[]', datetime('now'), datetime('now'))",
        params![title, target_lang, native_lang],
    )
    .map_err(|e| format!("Failed to create thread: {}", e))?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, title, target_language, native_language, messages_json, created_at, updated_at
         FROM question_threads WHERE id = ?1",
        params![id],
        row_to_question_thread,
    )
    .map_err(|e| format!("Failed to retrieve created thread: {}", e))
}

#[tauri::command]
pub fn delete_question_thread(id: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute("DELETE FROM question_threads WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete thread: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn update_question_thread_title(id: i64, title: String) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE question_threads SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![title, id],
    )
    .map_err(|e| format!("Failed to update thread title: {}", e))?;

    Ok(())
}

fn update_thread_messages(thread_id: i64, messages: &[QuestionMessage]) -> Result<(), String> {
    let conn = get_conn()?;

    let messages_json = serde_json::to_string(messages)
        .map_err(|e| format!("Failed to serialize messages: {}", e))?;

    conn.execute(
        "UPDATE question_threads SET messages_json = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![messages_json, thread_id],
    )
    .map_err(|e| format!("Failed to update messages: {}", e))?;

    Ok(())
}

fn build_grammar_system_prompt(target_lang: &str, native_lang: &str) -> String {
    let target_name = get_language_name(target_lang);
    let native_name = get_language_name(native_lang);

    format!(
        r#"You are a language learning assistant helping a {} speaker learn {}.
Answer questions about grammar, vocabulary, style, and usage.

IMPORTANT: Write ALL explanations and notes in {} language. Only example sentences should be in {}.

Format your response as JSON:
{{
  "explanation": "Your detailed explanation in {}...",
  "examples": [
    {{"sentence": "Example in {}", "translation": "Translation in {}", "notes": "Grammar note in {}"}}
  ]
}}

Provide 2-5 practical example sentences when relevant. Use B1-B2 vocabulary level.
Keep explanations clear and concise. Focus on practical usage."#,
        native_name, target_name, native_name, target_name, native_name, target_name, native_name, native_name
    )
}

fn build_translation_system_prompt(target_lang: &str, native_lang: &str) -> String {
    let target_name = get_language_name(target_lang);
    let native_name = get_language_name(native_lang);

    format!(
        r#"Translator {}<->{}.

RESPOND WITH JSON:
{{"explanation": "", "examples": [{{"sentence": "translation in {}", "translation": "original text in {}", "notes": ""}}]}}

RULES:
- Return translation as a single example
- "sentence" = the translation in target language
- "translation" = the original input text
- "explanation" = empty string (or very brief note ONLY for idioms)
- "notes" = empty string
- NO grammar explanations
- NO multiple examples

Example input: "Idę do domu"
Example output: {{"explanation": "", "examples": [{{"sentence": "Ich gehe nach Hause", "translation": "Idę do domu", "notes": ""}}]}}"#,
        native_name, target_name, target_name, native_name
    )
}

enum QuestionMode {
    Grammar,
    Translation(String), // Contains the text to translate (without prefix)
}

fn detect_question_mode(question: &str) -> QuestionMode {
    let trimmed = question.trim();

    // Check for translation prefixes (both /t and \t)
    let translation_prefixes = [
        "/t ", "/T ", "\\t ", "\\T ",
        "/t", "/T", "\\t", "\\T",  // without space
        "/translate ", "/Translate ",
        "przetłumacz:", "Przetłumacz:",
        "przetłumacz ", "Przetłumacz ",
        "translate:", "Translate:",
    ];

    for prefix in translation_prefixes {
        if let Some(rest) = trimmed.strip_prefix(prefix) {
            let text = rest.trim();
            if !text.is_empty() {
                return QuestionMode::Translation(text.to_string());
            }
        }
    }

    QuestionMode::Grammar
}

async fn call_llm_for_grammar(
    settings: &AppSettings,
    messages: &[serde_json::Value],
    system_prompt: &str,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    match settings.llm_provider.as_str() {
        "openai" => {
            let mut all_messages = vec![serde_json::json!({"role": "system", "content": system_prompt})];
            all_messages.extend(messages.iter().cloned());

            let body = serde_json::json!({
                "model": &settings.llm_model,
                "messages": all_messages,
                "max_tokens": 1500,
                "temperature": 0.7
            });

            let response = client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", settings.llm_api_key))
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("OpenAI request failed: {}", e))?;

            if !response.status().is_success() {
                let error_text = response.text().await.unwrap_or_default();
                return Err(format!("OpenAI API error: {}", error_text));
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

            let data: OpenAiResponse = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

            Ok(data
                .choices
                .first()
                .and_then(|c| c.message.content.clone())
                .unwrap_or_default())
        }
        "anthropic" => {
            let body = serde_json::json!({
                "model": &settings.llm_model,
                "max_tokens": 1500,
                "system": system_prompt,
                "messages": messages
            });

            let response = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &settings.llm_api_key)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Anthropic request failed: {}", e))?;

            if !response.status().is_success() {
                let error_text = response.text().await.unwrap_or_default();
                return Err(format!("Anthropic API error: {}", error_text));
            }

            #[derive(Deserialize)]
            struct AnthropicResponse {
                content: Vec<AnthropicContent>,
            }
            #[derive(Deserialize)]
            struct AnthropicContent {
                text: Option<String>,
            }

            let data: AnthropicResponse = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

            Ok(data
                .content
                .first()
                .and_then(|c| c.text.clone())
                .unwrap_or_default())
        }
        _ => Err(format!("Unknown LLM provider: {}", settings.llm_provider)),
    }
}

fn parse_grammar_response(content: &str) -> Result<GrammarQuestionResponse, String> {
    // Try to find JSON in the response
    let json_start = content.find('{');
    let json_end = content.rfind('}');

    match (json_start, json_end) {
        (Some(start), Some(end)) if end >= start => {
            let json_str = &content[start..=end];
            serde_json::from_str(json_str).map_err(|e| {
                // If JSON parsing fails, treat the content as plain explanation
                format!("JSON parse error: {}. Raw: {}", e, json_str)
            })
        }
        _ => {
            // No JSON found, treat the whole response as explanation
            Ok(GrammarQuestionResponse {
                explanation: content.to_string(),
                examples: vec![],
            })
        }
    }
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn ask_grammar_question(
    state: State<'_, AppState>,
    threadId: i64,
    question: String,
) -> Result<GrammarQuestionResponse, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    // Get the thread to access language settings and existing messages
    let thread = get_question_thread(threadId)?;

    // Detect mode and get appropriate prompt
    let mode = detect_question_mode(&question);
    let (system_prompt, actual_question) = match &mode {
        QuestionMode::Grammar => (
            build_grammar_system_prompt(&thread.target_language, &thread.native_language),
            question.clone(),
        ),
        QuestionMode::Translation(text) => (
            build_translation_system_prompt(&thread.target_language, &thread.native_language),
            text.clone(),
        ),
    };

    // Build message history for context
    let mut llm_messages: Vec<serde_json::Value> = thread
        .messages
        .iter()
        .map(|m| {
            let role = if m.role == "user" { "user" } else { "assistant" };
            // For assistant messages, include just the explanation part for context
            let content = if m.role == "assistant" {
                m.content.clone()
            } else {
                m.content.clone()
            };
            serde_json::json!({"role": role, "content": content})
        })
        .collect();

    // Add the new question (use actual_question for LLM, without prefix)
    llm_messages.push(serde_json::json!({"role": "user", "content": actual_question}));

    // Call the LLM
    let response_content = call_llm_for_grammar(&settings, &llm_messages, &system_prompt).await?;

    // Parse the response
    let grammar_response = parse_grammar_response(&response_content)?;

    // Create new messages to save
    let user_message = QuestionMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: "user".to_string(),
        content: question,
        examples: None,
    };

    let assistant_message = QuestionMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: "assistant".to_string(),
        content: grammar_response.explanation.clone(),
        examples: if grammar_response.examples.is_empty() {
            None
        } else {
            Some(grammar_response.examples.clone())
        },
    };

    // Update thread with new messages
    let mut updated_messages = thread.messages;
    updated_messages.push(user_message);
    updated_messages.push(assistant_message);
    update_thread_messages(threadId, &updated_messages)?;

    Ok(grammar_response)
}
