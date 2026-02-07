//! Material processing LLM commands.
//!
//! This module contains Tauri commands for processing learning materials,
//! including transcript parsing, token estimation, and sentence Q&A.

use crate::constants::llm::{ASK_SENTENCE_MAX_TOKENS, MATERIAL_CHUNK_MAX_TOKENS, MAX_CHUNK_INPUT_TOKENS};
use crate::constants::tokens::CHARS_PER_TOKEN_GERMAN;
use crate::db::get_conn;
use crate::models::{get_language_name, AskAboutSentenceResponse, MaterialThreadMessage, TextSegment};
use crate::state::AppState;
use crate::utils::lock::SafeRwLock;
use crate::utils::regex::TIMESTAMP_REGEX;
use rusqlite::params;
use tauri::{Emitter, State};

use super::client::call_llm;
use super::prompts::build_sentence_qa_system_prompt;
use super::types::{MaterialProcessingProgress, TokenEstimate};

/// Parse transcript into chunks with timestamps.
/// Returns pairs of (timestamp, text) where timestamp may be empty for plain text.
fn parse_transcript_with_timestamps(text: &str) -> Vec<(String, String)> {
    let mut result: Vec<(String, String)> = Vec::new();
    let mut current_ts = String::new();
    let mut current_text = Vec::new();

    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        if let Some(caps) = TIMESTAMP_REGEX.captures(line) {
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

/// Estimate token count for text (rough estimate).
/// German text uses about 1 token per 3 chars, English about 1 per 4.
fn estimate_tokens(text: &str) -> usize {
    // Use conservative estimate (3 chars per token for German)
    (text.len() + CHARS_PER_TOKEN_GERMAN - 1) / CHARS_PER_TOKEN_GERMAN
}

/// Split transcript chunks into batches that fit within token limits.
fn split_into_batches(chunks: Vec<(String, String)>) -> Vec<Vec<(String, String)>> {
    let mut batches = Vec::new();
    let mut current_batch = Vec::new();
    let mut current_tokens = 0;

    for chunk in chunks {
        let chunk_tokens = estimate_tokens(&chunk.1);

        if current_tokens + chunk_tokens > MAX_CHUNK_INPUT_TOKENS && !current_batch.is_empty() {
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

/// Estimate tokens and chunks for material processing.
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

/// Process a material: format into sentences and translate (with batching for long content).
/// Supports resuming from where it left off if previous processing failed.
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
    let settings = state.settings.safe_read()?.clone();

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
        let response = call_llm(&settings, &llm_messages, None, MATERIAL_CHUNK_MAX_TOKENS).await?;

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

/// Audio segment input for processing
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSegmentInput {
    pub text: String,
    pub audio_path: String,
}

/// Process audio segments: translate transcriptions and return complete segments.
/// Used for audio material type where we already have segmented text from Whisper.
#[tauri::command]
#[allow(non_snake_case)]
pub async fn process_audio_segments(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    materialId: i64,
    segments: Vec<AudioSegmentInput>,
    targetLanguage: String,
    nativeLanguage: String,
) -> Result<String, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    if segments.is_empty() {
        return Err("No audio segments provided".to_string());
    }

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

    // Split segments into batches based on token limits
    let mut batches: Vec<Vec<&AudioSegmentInput>> = Vec::new();
    let mut current_batch: Vec<&AudioSegmentInput> = Vec::new();
    let mut current_tokens = 0;

    for segment in &segments {
        let segment_tokens = estimate_tokens(&segment.text);

        if current_tokens + segment_tokens > MAX_CHUNK_INPUT_TOKENS && !current_batch.is_empty() {
            batches.push(current_batch);
            current_batch = Vec::new();
            current_tokens = 0;
        }

        current_tokens += segment_tokens;
        current_batch.push(segment);
    }

    if !current_batch.is_empty() {
        batches.push(current_batch);
    }

    let total_batches = batches.len();
    let mut all_segments: Vec<TextSegment> = Vec::new();

    // Process each batch
    for (batch_idx, batch) in batches.iter().enumerate() {
        // Build batch text - number each segment for LLM to maintain order
        let batch_text = batch
            .iter()
            .enumerate()
            .map(|(i, seg)| format!("[{}] {}", i + 1, seg.text))
            .collect::<Vec<_>>()
            .join("\n");

        let prompt = format!(
            r#"Translate these {} sentences to {}. Each sentence is numbered.

IMPORTANT:
- Keep the same numbering
- Return ONLY a JSON array with translations in the same order
- Each object should have "index" (the number) and "translation"

Sentences:
{}

Response format (JSON array only):
[{{"index": 1, "translation": "Translation here"}}]"#,
            target_name, native_name, batch_text
        );

        let llm_messages = vec![serde_json::json!({"role": "user", "content": prompt})];
        let response = call_llm(&settings, &llm_messages, None, MATERIAL_CHUNK_MAX_TOKENS).await?;

        // Parse response
        let json_start = response.content.find('[');
        let json_end = response.content.rfind(']');

        let (json_start, json_end) = match (json_start, json_end) {
            (Some(start), Some(end)) if end >= start => (start, end),
            _ => return Err(format!(
                "Failed to parse LLM response for batch {}. Raw: {}",
                batch_idx + 1, response.content
            )),
        };

        let json_str = &response.content[json_start..=json_end];

        #[derive(serde::Deserialize)]
        struct TranslationItem {
            index: usize,
            translation: String,
        }

        let translations: Vec<TranslationItem> = serde_json::from_str(json_str)
            .map_err(|e| format!(
                "Failed to parse translations for batch {}: {}. Raw JSON: {}",
                batch_idx + 1, e, json_str
            ))?;

        // Map translations back to segments
        for (i, seg) in batch.iter().enumerate() {
            let translation = translations
                .iter()
                .find(|t| t.index == i + 1)
                .map(|t| t.translation.clone())
                .unwrap_or_else(|| "[Translation not found]".to_string());

            all_segments.push(TextSegment {
                text: seg.text.clone(),
                translation,
                timestamp: None,
                audio_path: Some(seg.audio_path.clone()),
            });
        }

        // Emit progress
        let progress = MaterialProcessingProgress {
            material_id: materialId,
            current_chunk: batch_idx + 1,
            total_chunks: total_batches,
            percent: (((batch_idx + 1) as f32) / (total_batches as f32)) * 100.0,
        };
        let _ = app.emit("material-processing-progress", &progress);

        // Save progress after each batch
        {
            let partial_result = serde_json::to_string(&all_segments)
                .map_err(|e| format!("Failed to serialize segments: {}", e))?;
            let conn = get_conn()?;
            conn.execute(
                "UPDATE materials SET segments_json = ?1, updated_at = datetime('now') WHERE id = ?2",
                params![partial_result, materialId],
            )
            .map_err(|e| format!("Failed to save progress: {}", e))?;
        }
    }

    let result = serde_json::to_string(&all_segments)
        .map_err(|e| format!("Failed to serialize segments: {}", e))?;

    // Set status to ready
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

/// Ask a question about a sentence from a material.
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
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured".to_string());
    }

    let system_prompt = build_sentence_qa_system_prompt(
        &sentence,
        &translation,
        &targetLanguage,
        &nativeLanguage,
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

    let response = call_llm(&settings, &llm_messages, Some(&system_prompt), ASK_SENTENCE_MAX_TOKENS).await?;

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
