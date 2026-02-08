//! AI-powered deck generation module.
//!
//! This module provides functionality to generate language learning decks
//! with phrases tailored to specific CEFR levels and vocabulary categories.

use crate::constants::deck_generation::GENERATION_MAX_TOKENS;
use crate::db::get_conn;
use crate::models::{get_language_name, Deck, GenerateDeckRequest, GenerateDeckResponse};
use crate::state::AppState;
use crate::utils::lock::SafeRwLock;
use rusqlite::params;
use serde::Deserialize;
use tauri::State;

use super::client::call_llm;

/// Generated phrase from LLM
#[derive(Debug, Deserialize)]
struct GeneratedPhrase {
    prompt: String,
    answer: String,
    #[serde(default)]
    accepted: Vec<String>,
}

/// LLM response structure for deck generation
#[derive(Debug, Deserialize)]
struct GenerationResponse {
    phrases: Vec<GeneratedPhrase>,
}

/// Build system prompt for deck generation
fn build_generation_system_prompt(
    level: &str,
    category: Option<&str>,
    target_language: &str,
    native_language: &str,
) -> String {
    let target_name = get_language_name(target_language);
    let native_name = get_language_name(native_language);

    let level_guidance = match level {
        "A1" => "Basic vocabulary: greetings, numbers 1-20, simple everyday objects, basic verbs (be, have, go, want). Use present tense only. Very short sentences (3-5 words).",
        "A2" => "Elementary vocabulary: shopping, directions, time expressions, past tense for common situations. Simple sentences with common conjunctions.",
        "B1" => "Intermediate vocabulary: opinions, feelings, work situations, conditional sentences. More complex sentence structures, common idioms.",
        "B2" => "Upper-intermediate vocabulary: abstract topics, formal expressions, passive voice, reported speech. Longer sentences with multiple clauses.",
        "C1" => "Advanced vocabulary: nuanced expressions, academic language, subtle differences in meaning, complex grammar structures.",
        "C2" => "Near-native vocabulary: idioms, slang, regional expressions, literary references, highly nuanced language.",
        _ => "General vocabulary appropriate for intermediate learners.",
    };

    let category_instruction = category
        .map(|c| format!("\nFocus on the topic: {}.", c))
        .unwrap_or_default();

    format!(
        r#"You are a language learning assistant creating {} vocabulary for {} speakers learning {}.

Level guidance for {}: {}{}

Generate practical, useful phrases that a learner would actually use. Each phrase should:
1. Be appropriate for the specified CEFR level
2. Be natural and commonly used
3. Have a clear translation
4. Include 1-2 accepted alternative answers where applicable

IMPORTANT: The "prompt" field should be in {} (what the learner sees), and "answer" should be in {} (what they need to produce).

Respond with JSON in this exact format:
{{
  "phrases": [
    {{"prompt": "{} translation/prompt", "answer": "{} phrase", "accepted": ["alternative1", "alternative2"]}},
    ...
  ]
}}

Generate exactly the requested number of phrases. Make them diverse and useful."#,
        level,
        native_name,
        target_name,
        level,
        level_guidance,
        category_instruction,
        native_name,
        target_name,
        native_name,
        target_name
    )
}

/// Generate a new deck with AI-generated phrases.
#[tauri::command]
pub async fn generate_deck(
    state: State<'_, AppState>,
    request: GenerateDeckRequest,
) -> Result<GenerateDeckResponse, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured. Please set up your API key in Settings.".to_string());
    }

    let target_lang = request
        .target_language
        .clone()
        .unwrap_or_else(|| settings.target_language.clone());
    let native_lang = request
        .native_language
        .clone()
        .unwrap_or_else(|| settings.native_language.clone());

    // Validate phrase count
    let phrase_count = request.phrase_count.clamp(5, 50);

    // Build system prompt
    let system_prompt = build_generation_system_prompt(
        &request.level,
        request.category.as_deref(),
        &target_lang,
        &native_lang,
    );

    // Build user message
    let user_message = format!(
        "Generate {} {} phrases for level {}{}.",
        phrase_count,
        get_language_name(&target_lang),
        request.level,
        request
            .category
            .as_ref()
            .map(|c| format!(" about {}", c))
            .unwrap_or_default()
    );

    let messages = vec![serde_json::json!({"role": "user", "content": user_message})];

    // Call LLM
    let response = call_llm(&settings, &messages, Some(&system_prompt), GENERATION_MAX_TOKENS).await?;

    // Parse response
    let generation: GenerationResponse = serde_json::from_str(&response.content)
        .map_err(|e| format!("Failed to parse LLM response: {}. Response was: {}", e, response.content))?;

    if generation.phrases.is_empty() {
        return Err("LLM returned no phrases".to_string());
    }

    // Create deck and phrases in database
    let conn = get_conn()?;

    // Create deck
    conn.execute(
        "INSERT INTO decks (name, description, target_language, native_language, graduation_threshold, level, category)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            request.name,
            request.description,
            target_lang,
            native_lang,
            2, // default graduation threshold
            request.level,
            request.category
        ],
    )
    .map_err(|e| format!("Failed to create deck: {}", e))?;

    let deck_id = conn.last_insert_rowid();

    // Record deck source
    conn.execute(
        "INSERT INTO deck_sources (deck_id, source_type, generated_at, metadata_json)
         VALUES (?1, 'ai_generated', datetime('now'), ?2)",
        params![
            deck_id,
            serde_json::json!({
                "level": request.level,
                "category": request.category,
                "phrase_count": phrase_count,
                "model": settings.llm_model,
                "provider": settings.llm_provider
            }).to_string()
        ],
    )
    .map_err(|e| format!("Failed to record deck source: {}", e))?;

    // Insert phrases
    let mut phrases_created = 0;
    for phrase in &generation.phrases {
        let accepted_json = serde_json::to_string(&phrase.accepted)
            .unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "INSERT INTO phrases (prompt, answer, accepted_json, target_language, native_language, deck_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                phrase.prompt,
                phrase.answer,
                accepted_json,
                target_lang,
                native_lang,
                deck_id
            ],
        )
        .map_err(|e| format!("Failed to create phrase: {}", e))?;

        let phrase_id = conn.last_insert_rowid();

        // Create phrase progress with deck_learning status
        conn.execute(
            "INSERT INTO phrase_progress (phrase_id, learning_status, in_srs_pool, deck_correct_count)
             VALUES (?1, 'deck_learning', 0, 0)",
            params![phrase_id],
        )
        .map_err(|e| format!("Failed to create phrase progress: {}", e))?;

        phrases_created += 1;
    }

    // Fetch created deck
    let deck = conn
        .query_row(
            "SELECT id, name, description, target_language, native_language,
                    graduation_threshold, created_at, updated_at, level, category
             FROM decks WHERE id = ?1",
            params![deck_id],
            |row| {
                Ok(Deck {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    target_language: row.get(3)?,
                    native_language: row.get(4)?,
                    graduation_threshold: row.get(5)?,
                    level: row.get(8)?,
                    category: row.get(9)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| format!("Failed to fetch created deck: {}", e))?;

    Ok(GenerateDeckResponse {
        deck,
        phrases_created,
    })
}

/// Extend an existing deck with more AI-generated phrases.
#[tauri::command]
#[allow(non_snake_case)]
pub async fn extend_deck(
    state: State<'_, AppState>,
    deckId: i64,
    phraseCount: i32,
) -> Result<i32, String> {
    let settings = state.settings.safe_read()?.clone();

    if settings.llm_api_key.is_empty() {
        return Err("LLM API key not configured. Please set up your API key in Settings.".to_string());
    }

    // First, get all necessary data from the database BEFORE the async call
    let (target_lang, native_lang, level, category, existing): (
        String,
        String,
        String,
        Option<String>,
        Vec<String>,
    ) = {
        let conn = get_conn()?;

        // Fetch deck info
        let (target_lang, native_lang, level, category): (String, String, Option<String>, Option<String>) = conn
            .query_row(
                "SELECT target_language, native_language, level, category FROM decks WHERE id = ?1",
                params![deckId],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|e| format!("Deck not found: {}", e))?;

        let level = level.unwrap_or_else(|| "B1".to_string());

        // Get existing phrases to avoid duplicates
        let mut stmt = conn
            .prepare("SELECT answer FROM phrases WHERE deck_id = ?1")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let existing: Vec<String> = stmt
            .query_map(params![deckId], |row| row.get(0))
            .map_err(|e| format!("Failed to query existing phrases: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect phrases: {}", e))?;

        (target_lang, native_lang, level, category, existing)
    };

    let phrase_count = phraseCount.clamp(5, 50);

    // Build system prompt
    let system_prompt = build_generation_system_prompt(
        &level,
        category.as_deref(),
        &target_lang,
        &native_lang,
    );

    let existing_list = if existing.is_empty() {
        String::new()
    } else {
        format!(
            "\n\nAVOID duplicating these existing phrases:\n{}",
            existing.iter().take(30).cloned().collect::<Vec<_>>().join(", ")
        )
    };

    // Build user message
    let user_message = format!(
        "Generate {} additional {} phrases for level {}{}.{}",
        phrase_count,
        get_language_name(&target_lang),
        level,
        category
            .as_ref()
            .map(|c| format!(" about {}", c))
            .unwrap_or_default(),
        existing_list
    );

    let messages = vec![serde_json::json!({"role": "user", "content": user_message})];

    // Call LLM (async operation)
    let response = call_llm(&settings, &messages, Some(&system_prompt), GENERATION_MAX_TOKENS).await?;

    // Parse response
    let generation: GenerationResponse = serde_json::from_str(&response.content)
        .map_err(|e| format!("Failed to parse LLM response: {}", e))?;

    if generation.phrases.is_empty() {
        return Err("LLM returned no phrases".to_string());
    }

    // Now get a new connection for inserting phrases (after the async call)
    let conn = get_conn()?;

    // Insert new phrases
    let mut phrases_created = 0;
    for phrase in &generation.phrases {
        // Skip if duplicate
        if existing.iter().any(|e| e.to_lowercase() == phrase.answer.to_lowercase()) {
            continue;
        }

        let accepted_json = serde_json::to_string(&phrase.accepted)
            .unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "INSERT INTO phrases (prompt, answer, accepted_json, target_language, native_language, deck_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                phrase.prompt,
                phrase.answer,
                accepted_json,
                target_lang,
                native_lang,
                deckId
            ],
        )
        .map_err(|e| format!("Failed to create phrase: {}", e))?;

        let phrase_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO phrase_progress (phrase_id, learning_status, in_srs_pool, deck_correct_count)
             VALUES (?1, 'deck_learning', 0, 0)",
            params![phrase_id],
        )
        .map_err(|e| format!("Failed to create phrase progress: {}", e))?;

        phrases_created += 1;
    }

    Ok(phrases_created)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_generation_system_prompt_a1() {
        let prompt = build_generation_system_prompt("A1", None, "de", "pl");
        assert!(prompt.contains("A1"));
        assert!(prompt.contains("German"));
        assert!(prompt.contains("Polish"));
        assert!(prompt.contains("Basic vocabulary"));
    }

    #[test]
    fn test_build_generation_system_prompt_with_category() {
        let prompt = build_generation_system_prompt("B1", Some("travel"), "de", "en");
        assert!(prompt.contains("B1"));
        assert!(prompt.contains("travel"));
        assert!(prompt.contains("Intermediate vocabulary"));
    }

    #[test]
    fn test_parse_generation_response() {
        let json = r#"{
            "phrases": [
                {"prompt": "Dzien dobry", "answer": "Guten Tag", "accepted": ["Guten tag"]},
                {"prompt": "Do widzenia", "answer": "Auf Wiedersehen", "accepted": []}
            ]
        }"#;

        let response: GenerationResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.phrases.len(), 2);
        assert_eq!(response.phrases[0].prompt, "Dzien dobry");
        assert_eq!(response.phrases[0].answer, "Guten Tag");
        assert_eq!(response.phrases[0].accepted.len(), 1);
    }
}
