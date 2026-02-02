use crate::db::get_conn;
use crate::models::{get_language_name, AppSettings, AskAboutSentenceResponse, ChatMessage, ConversationCleanupResult, MaterialThreadMessage, Phrase, PhraseThreadMessage, RefinePhraseSuggestion, SuggestedPhrase, TextSegment};
use rusqlite::params;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{State, Emitter};

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
    let target_name = get_language_name(target_lang);
    let native_name = get_language_name(native_lang);

    format!(
        r#"You are a translator. Translate {} to natural spoken {}.
Topic context: {}

RULES:
- Output ONLY the {} translation - no quotes, no explanations, no JSON, no formatting
- Sound natural, like a native speaker in casual conversation
- B1-B2 vocabulary level

Input: Cześć, jak się masz?
Output: Hallo! Wie geht's dir?

Input: Byłem na zakupach
Output: Ich war einkaufen."#,
        native_name, target_name, subject, target_name
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

fn build_refinement_system_prompt(phrase: &Phrase) -> String {
    let target_name = get_language_name(&phrase.target_language);
    let native_name = get_language_name(&phrase.native_language);

    format!(
        r#"You are a language learning assistant helping refine phrases for a {} learner whose native language is {}.

Current phrase:
- Prompt ({}): {}
- Answer ({}): {}
- Accepted alternatives: {}

Your role is to help the user refine this phrase based on their requests. You might be asked to:
- Make it more casual/formal
- Add alternative forms or variations
- Fix grammar or spelling issues
- Make it more natural sounding
- Simplify or elaborate the phrase
- Change the context or nuance

When you suggest changes, respond with JSON in this exact format:
{{
  "suggestion": {{
    "prompt": "new prompt in {} (or null if unchanged)",
    "answer": "new answer in {} (or null if unchanged)",
    "accepted": ["array", "of", "alternatives"] or null if unchanged,
    "explanation": "Brief explanation of your changes"
  }}
}}

Always include the explanation. Only include fields that you're suggesting to change.
If the user just asks a question or wants clarification without changes, respond with:
{{
  "suggestion": {{
    "prompt": null,
    "answer": null,
    "accepted": null,
    "explanation": "Your answer to their question"
  }}
}}"#,
        target_name,
        native_name,
        native_name,
        phrase.prompt,
        target_name,
        phrase.answer,
        phrase.accepted.join(", "),
        native_name,
        target_name
    )
}

#[tauri::command]
pub async fn refine_phrase(
    state: State<'_, AppState>,
    phrase: Phrase,
    messages: Vec<PhraseThreadMessage>,
    user_message: String,
) -> Result<RefinePhraseSuggestion, String> {
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

    let system_prompt = build_refinement_system_prompt(&phrase);

    // Convert thread messages to LLM format, then add the new user message
    let mut llm_messages: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            let role = if m.role == "user" { "user" } else { "assistant" };
            serde_json::json!({"role": role, "content": m.content})
        })
        .collect();

    llm_messages.push(serde_json::json!({"role": "user", "content": user_message}));

    let response = call_llm(&settings, &llm_messages, Some(&system_prompt), 1000).await?;

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

/// Generate a short, meaningful title from content (conversation or question)
#[tauri::command]
pub async fn generate_title(
    state: State<'_, AppState>,
    content: String,
    content_type: String, // "conversation" or "question"
    native_language: Option<String>,
) -> Result<String, String> {
    let settings = state.settings.lock().unwrap().clone();

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

    let response = call_llm(&settings, &llm_messages, None, 50).await?;

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

/// Parse transcript into chunks with timestamps
/// Returns pairs of (timestamp, text) where timestamp may be empty for plain text
fn parse_transcript_with_timestamps(text: &str) -> Vec<(String, String)> {
    let ts_re = regex::Regex::new(r"^\[?(\d+:\d+(?::\d+)?)\]?\s*$").unwrap();
    let mut result: Vec<(String, String)> = Vec::new();
    let mut current_ts = String::new();
    let mut current_text = Vec::new();

    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        if let Some(caps) = ts_re.captures(line) {
            // New timestamp - save previous chunk if any
            if !current_text.is_empty() {
                result.push((current_ts.clone(), current_text.join(" ")));
                current_text.clear();
            }
            current_ts = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
        } else {
            current_text.push(line.to_string());
        }
    }

    // Don't forget the last chunk
    if !current_text.is_empty() {
        result.push((current_ts, current_text.join(" ")));
    }

    result
}

/// Estimate token count for text (rough estimate)
/// German text uses about 1 token per 3 chars, English about 1 per 4
fn estimate_tokens(text: &str) -> usize {
    // Use conservative estimate (3 chars per token for German)
    (text.len() + 2) / 3
}

/// Maximum tokens per chunk (conservative to avoid timeouts)
const MAX_CHUNK_TOKENS: usize = 1000;

/// Split transcript chunks into batches that fit within token limits
fn split_into_batches(chunks: Vec<(String, String)>) -> Vec<Vec<(String, String)>> {
    let mut batches = Vec::new();
    let mut current_batch = Vec::new();
    let mut current_tokens = 0;

    for chunk in chunks {
        let chunk_tokens = estimate_tokens(&chunk.1);

        if current_tokens + chunk_tokens > MAX_CHUNK_TOKENS && !current_batch.is_empty() {
            batches.push(current_batch);
            current_batch = Vec::new();
            current_tokens = 0;
        }

        current_tokens += chunk_tokens;
        current_batch.push(chunk);
    }

    if !current_batch.is_empty() {
        batches.push(current_batch);
    }

    batches
}

/// Estimate tokens and chunks for material processing
#[tauri::command]
#[allow(non_snake_case)]
pub fn estimate_material_tokens(
    text: String,
    materialType: String,
) -> Result<TokenEstimate, String> {
    let chunks = if materialType == "transcript" {
        parse_transcript_with_timestamps(&text)
    } else {
        vec![("".to_string(), text.clone())]
    };

    let total_text: String = chunks.iter().map(|(_, t)| t.as_str()).collect::<Vec<_>>().join(" ");
    let estimated_tokens = estimate_tokens(&total_text);

    let batches = split_into_batches(chunks);
    let chunk_count = batches.len();

    // Rough cost estimate (GPT-4 pricing ~$0.03/1K input, $0.06/1K output)
    // Output is roughly 2x input for translation
    let estimated_cost_usd = (estimated_tokens as f64 / 1000.0) * 0.03
        + (estimated_tokens as f64 * 2.0 / 1000.0) * 0.06;

    Ok(TokenEstimate {
        estimated_tokens,
        chunk_count,
        estimated_cost_usd,
    })
}

/// Process a material: format into sentences and translate (with batching for long content)
/// Supports resuming from where it left off if previous processing failed
#[tauri::command]
#[allow(non_snake_case)]
pub async fn process_material(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    materialId: i64,
    materialType: String,
    text: String,
    targetLanguage: String,
    nativeLanguage: String,
) -> Result<String, String> {
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

    // Load existing progress (for resume capability)
    let (existing_segments, processed_chunks): (Vec<TextSegment>, i64) = {
        let conn = get_conn()?;
        let result: Result<(Option<String>, i64), _> = conn.query_row(
            "SELECT segments_json, COALESCE(processed_chunks, 0) FROM materials WHERE id = ?1",
            params![materialId],
            |row| Ok((row.get(0)?, row.get(1)?)),
        );
        match result {
            Ok((Some(json), chunks)) if !json.is_empty() => {
                let segments: Vec<TextSegment> = serde_json::from_str(&json).unwrap_or_default();
                (segments, chunks)
            }
            Ok((_, chunks)) => (Vec::new(), chunks),
            Err(_) => (Vec::new(), 0),
        }
    };

    // Update status to processing
    {
        let conn = get_conn()?;
        conn.execute(
            "UPDATE materials SET status = 'processing', updated_at = datetime('now') WHERE id = ?1",
            params![materialId],
        )
        .map_err(|e| format!("Failed to update status: {}", e))?;
    }

    let target_name = get_language_name(&targetLanguage);
    let native_name = get_language_name(&nativeLanguage);

    // For transcripts, parse with timestamps and split into batches
    let has_timestamps = materialType == "transcript";
    let batches = if has_timestamps {
        let chunks = parse_transcript_with_timestamps(&text);
        if chunks.is_empty() {
            return Err("No text content found".to_string());
        }
        split_into_batches(chunks)
    } else {
        // Plain text - single batch
        vec![vec![("".to_string(), text.clone())]]
    };

    let total_batches = batches.len();
    let start_batch = processed_chunks as usize;

    // Initialize with existing segments if resuming
    let mut all_segments: Vec<TextSegment> = existing_segments;

    // Calculate initial progress based on already processed chunks
    let initial_percent = if total_batches > 0 {
        (start_batch as f32 / total_batches as f32) * 100.0
    } else {
        0.0
    };

    // Emit initial progress
    let _ = app.emit("material-processing-progress", &MaterialProcessingProgress {
        material_id: materialId,
        current_chunk: start_batch,
        total_chunks: total_batches,
        percent: initial_percent,
    });

    // Process each batch (skip already processed ones)
    for (batch_idx, batch) in batches.into_iter().enumerate() {
        // Skip already processed batches
        if batch_idx < start_batch {
            continue;
        }
        // Format batch text with timestamp markers
        let batch_text = batch
            .iter()
            .map(|(ts, txt)| {
                if ts.is_empty() {
                    txt.clone()
                } else {
                    format!("[{}] {}", ts, txt)
                }
            })
            .collect::<Vec<_>>()
            .join(" ");

        if batch_text.trim().is_empty() {
            continue;
        }

        // Build prompt for this batch
        let prompt = if has_timestamps {
            format!(
                r#"Take this {} text with timestamps and format it into complete, proper sentences. Then translate each sentence to {}.

IMPORTANT:
- Fix any fragmented or run-on text into proper sentences
- Each sentence should be complete and make sense on its own
- Preserve the original meaning
- KEEP the timestamp from where each sentence starts (use the timestamp of the first word)
- Return ONLY a JSON array, no other text

Text:
{}

Response format (JSON array only):
[{{"text": "Complete German sentence.", "translation": "Complete {} translation.", "timestamp": "0:15"}}]"#,
                target_name, native_name, batch_text, native_name
            )
        } else {
            format!(
                r#"Take this {} text and format it into complete, proper sentences. Then translate each sentence to {}.

IMPORTANT:
- Fix any fragmented or run-on text into proper sentences
- Each sentence should be complete and make sense on its own
- Preserve the original meaning
- Return ONLY a JSON array, no other text

Text:
{}

Response format (JSON array only):
[{{"text": "Complete German sentence.", "translation": "Complete {} translation."}}]"#,
                target_name, native_name, batch_text, native_name
            )
        };

        let llm_messages = vec![serde_json::json!({"role": "user", "content": prompt})];
        let response = call_llm(&settings, &llm_messages, None, 4000).await?;

        // Parse response
        let json_start = response.content.find('[');
        let json_end = response.content.rfind(']');

        let (json_start, json_end) = match (json_start, json_end) {
            (Some(start), Some(end)) if end >= start => (start, end),
            _ => return Err(format!("Failed to parse LLM response for batch {}. Raw: {}", batch_idx + 1, response.content)),
        };

        let json_str = &response.content[json_start..=json_end];
        let batch_segments: Vec<TextSegment> = serde_json::from_str(json_str)
            .map_err(|e| format!("Failed to parse segments for batch {}: {}. Raw JSON: {}", batch_idx + 1, e, json_str))?;

        all_segments.extend(batch_segments);

        // Save progress after each batch (so we don't lose work on failure)
        // Also save processed_chunks so we can resume from here
        {
            let partial_result = serde_json::to_string(&all_segments)
                .map_err(|e| format!("Failed to serialize segments: {}", e))?;
            let chunks_completed = (batch_idx + 1) as i64;
            let conn = get_conn()?;
            conn.execute(
                "UPDATE materials SET segments_json = ?1, processed_chunks = ?2, updated_at = datetime('now') WHERE id = ?3",
                params![partial_result, chunks_completed, materialId],
            )
            .map_err(|e| format!("Failed to save progress: {}", e))?;
        }

        // Emit progress after successful chunk
        let progress = MaterialProcessingProgress {
            material_id: materialId,
            current_chunk: batch_idx + 1,
            total_chunks: total_batches,
            percent: (((batch_idx + 1) as f32) / (total_batches as f32)) * 100.0,
        };
        let _ = app.emit("material-processing-progress", &progress);
    }

    // Emit final progress (100%)
    let progress = MaterialProcessingProgress {
        material_id: materialId,
        current_chunk: total_batches,
        total_chunks: total_batches,
        percent: 100.0,
    };
    let _ = app.emit("material-processing-progress", &progress);

    let result = serde_json::to_string(&all_segments)
        .map_err(|e| format!("Failed to serialize segments: {}", e))?;

    // Set status to ready (segments already saved after each batch)
    {
        let conn = get_conn()?;
        conn.execute(
            "UPDATE materials SET status = 'ready', updated_at = datetime('now') WHERE id = ?1",
            params![materialId],
        )
        .map_err(|e| format!("Failed to update material: {}", e))?;
    }

    Ok(result)
}

/// Ask a question about a sentence from a material
#[tauri::command]
#[allow(non_snake_case)]
pub async fn ask_about_sentence(
    state: State<'_, AppState>,
    sentence: String,
    translation: String,
    question: String,
    previousMessages: Vec<MaterialThreadMessage>,
    targetLanguage: String,
    nativeLanguage: String,
) -> Result<AskAboutSentenceResponse, String> {
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

    let target_name = get_language_name(&targetLanguage);
    let native_name = get_language_name(&nativeLanguage);

    let system_prompt = format!(
        r#"You are a language learning assistant helping a {} speaker learn {}.

The student is studying this sentence:
{}: "{}"
{}: "{}"

Help them understand vocabulary, grammar, or usage. When explaining:
1. Answer their question clearly in {}
2. Provide 1-3 useful example phrases/sentences that demonstrate the concept
3. Each example should be a complete, practical sentence they can learn

Always respond with JSON in this exact format:
{{
  "explanation": "Your explanation in {}",
  "phrases": [
    {{"prompt": "{} translation", "answer": "{} sentence", "accepted": []}}
  ]
}}"#,
        native_name, target_name,
        target_name, sentence,
        native_name, translation,
        native_name,
        native_name,
        native_name, target_name
    );

    // Build conversation history
    let mut llm_messages: Vec<serde_json::Value> = previousMessages
        .iter()
        .map(|m| {
            let role = if m.role == "user" { "user" } else { "assistant" };
            serde_json::json!({"role": role, "content": m.content})
        })
        .collect();

    llm_messages.push(serde_json::json!({"role": "user", "content": question}));

    let response = call_llm(&settings, &llm_messages, Some(&system_prompt), 1500).await?;

    // Parse JSON response
    let json_start = response.content.find('{');
    let json_end = response.content.rfind('}');

    let (json_start, json_end) = match (json_start, json_end) {
        (Some(start), Some(end)) if end >= start => (start, end),
        _ => {
            // If no JSON, treat whole response as explanation with no phrases
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
