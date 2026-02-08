//! Deck pack import functionality.
//!
//! This module handles importing deck packs - JSON files containing
//! pre-made decks with phrases for language learning.

use crate::db::get_conn;
use crate::state::AppState;
use crate::utils::lock::SafeRwLock;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

/// A phrase within a deck pack
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckPackPhrase {
    pub prompt: String,
    pub answer: String,
    #[serde(default)]
    pub accepted: Vec<String>,
}

/// A deck within a deck pack
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckPackDeck {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub level: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    pub phrases: Vec<DeckPackPhrase>,
}

/// A deck pack file format
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckPack {
    pub version: i32,
    pub pack_name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub source_url: Option<String>,
    pub decks: Vec<DeckPackDeck>,
}

/// Import mode for deck packs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeckImportMode {
    /// Create new decks, skip if name already exists
    SkipExisting,
    /// Create new decks, merge phrases into existing decks with same name
    MergeIntoExisting,
    /// Always create new decks (may create duplicates)
    CreateNew,
}

/// Result of validating a deck pack
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckPackValidation {
    pub valid: bool,
    pub pack_name: String,
    pub deck_count: i32,
    pub phrase_count: i32,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Result of importing a deck pack
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckPackImportResult {
    pub success: bool,
    pub message: String,
    pub decks_created: i32,
    pub decks_merged: i32,
    pub phrases_created: i32,
    pub phrases_skipped: i32,
    pub created_deck_ids: Vec<i64>,
}

/// Validate a deck pack JSON without importing.
#[tauri::command]
#[allow(non_snake_case)]
pub fn validate_deck_pack(jsonContent: String) -> Result<DeckPackValidation, String> {
    let pack: DeckPack = match serde_json::from_str(&jsonContent) {
        Ok(p) => p,
        Err(e) => {
            return Ok(DeckPackValidation {
                valid: false,
                pack_name: "Unknown".to_string(),
                deck_count: 0,
                phrase_count: 0,
                errors: vec![format!("Invalid JSON format: {}", e)],
                warnings: vec![],
            });
        }
    };

    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let mut phrase_count = 0;

    // Validate version
    if pack.version != 1 {
        warnings.push(format!(
            "Unknown pack version: {}. This may cause compatibility issues.",
            pack.version
        ));
    }

    // Validate decks
    if pack.decks.is_empty() {
        errors.push("Pack contains no decks".to_string());
    }

    for (i, deck) in pack.decks.iter().enumerate() {
        if deck.name.trim().is_empty() {
            errors.push(format!("Deck {} has no name", i + 1));
        }

        if deck.phrases.is_empty() {
            warnings.push(format!("Deck '{}' has no phrases", deck.name));
        }

        for (j, phrase) in deck.phrases.iter().enumerate() {
            if phrase.prompt.trim().is_empty() {
                errors.push(format!(
                    "Deck '{}', phrase {} has empty prompt",
                    deck.name,
                    j + 1
                ));
            }
            if phrase.answer.trim().is_empty() {
                errors.push(format!(
                    "Deck '{}', phrase {} has empty answer",
                    deck.name,
                    j + 1
                ));
            }
            phrase_count += 1;
        }

        // Validate level if present
        if let Some(ref level) = deck.level {
            let valid_levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
            if !valid_levels.contains(&level.to_uppercase().as_str()) {
                warnings.push(format!(
                    "Deck '{}' has unknown level: {}",
                    deck.name, level
                ));
            }
        }
    }

    Ok(DeckPackValidation {
        valid: errors.is_empty(),
        pack_name: pack.pack_name,
        deck_count: pack.decks.len() as i32,
        phrase_count,
        errors,
        warnings,
    })
}

/// Import a deck pack from JSON content.
#[tauri::command]
#[allow(non_snake_case)]
pub fn import_deck_pack(
    state: State<'_, AppState>,
    jsonContent: String,
    importMode: DeckImportMode,
) -> Result<DeckPackImportResult, String> {
    let pack: DeckPack = serde_json::from_str(&jsonContent)
        .map_err(|e| format!("Invalid JSON format: {}", e))?;

    let settings = state.settings.safe_read()?.clone();
    let target_lang = settings.target_language.clone();
    let native_lang = settings.native_language.clone();

    let mut conn = get_conn()?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    let mut decks_created = 0;
    let mut decks_merged = 0;
    let mut phrases_created = 0;
    let mut phrases_skipped = 0;
    let mut created_deck_ids = Vec::new();

    for pack_deck in &pack.decks {
        // Check if deck with this name exists
        let existing_deck_id: Option<i64> = tx
            .query_row(
                "SELECT id FROM decks WHERE name = ?1 AND target_language = ?2",
                params![pack_deck.name, target_lang],
                |row| row.get(0),
            )
            .ok();

        let deck_id = match (existing_deck_id, importMode) {
            (Some(_), DeckImportMode::SkipExisting) => {
                // Skip this deck entirely
                phrases_skipped += pack_deck.phrases.len() as i32;
                continue;
            }
            (Some(id), DeckImportMode::MergeIntoExisting) => {
                decks_merged += 1;
                id
            }
            (None, _) | (_, DeckImportMode::CreateNew) => {
                // Create new deck
                let level = pack_deck
                    .level
                    .as_ref()
                    .map(|l| l.to_uppercase())
                    .filter(|l| ["A1", "A2", "B1", "B2", "C1", "C2"].contains(&l.as_str()));

                tx.execute(
                    "INSERT INTO decks (name, description, target_language, native_language, graduation_threshold, level, category)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        pack_deck.name,
                        pack_deck.description,
                        target_lang,
                        native_lang,
                        2,
                        level,
                        pack_deck.category
                    ],
                )
                .map_err(|e| format!("Failed to create deck: {}", e))?;

                let new_id = tx.last_insert_rowid();

                // Record deck source
                tx.execute(
                    "INSERT INTO deck_sources (deck_id, source_type, source_identifier, metadata_json)
                     VALUES (?1, 'imported', ?2, ?3)",
                    params![
                        new_id,
                        pack.source_url,
                        serde_json::json!({
                            "pack_name": pack.pack_name,
                            "pack_version": pack.version
                        }).to_string()
                    ],
                )
                .map_err(|e| format!("Failed to record deck source: {}", e))?;

                decks_created += 1;
                created_deck_ids.push(new_id);
                new_id
            }
        };

        // Get existing phrases in deck to avoid duplicates
        let existing_phrases: Vec<String> = if importMode == DeckImportMode::MergeIntoExisting {
            let mut stmt = tx
                .prepare("SELECT LOWER(answer) FROM phrases WHERE deck_id = ?1")
                .map_err(|e| format!("Failed to prepare query: {}", e))?;
            let result: Vec<String> = stmt
                .query_map(params![deck_id], |row| row.get(0))
                .map_err(|e| format!("Failed to query: {}", e))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("Failed to collect: {}", e))?;
            result
        } else {
            Vec::new()
        };

        // Insert phrases
        for phrase in &pack_deck.phrases {
            // Skip duplicates when merging
            if importMode == DeckImportMode::MergeIntoExisting
                && existing_phrases.contains(&phrase.answer.to_lowercase())
            {
                phrases_skipped += 1;
                continue;
            }

            let accepted_json = serde_json::to_string(&phrase.accepted)
                .unwrap_or_else(|_| "[]".to_string());

            tx.execute(
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

            let phrase_id = tx.last_insert_rowid();

            tx.execute(
                "INSERT INTO phrase_progress (phrase_id, learning_status, in_srs_pool, deck_correct_count)
                 VALUES (?1, 'deck_learning', 0, 0)",
                params![phrase_id],
            )
            .map_err(|e| format!("Failed to create phrase progress: {}", e))?;

            phrases_created += 1;
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    let message = if decks_created > 0 || decks_merged > 0 {
        format!(
            "Imported {} deck(s), {} phrase(s){}{}",
            decks_created + decks_merged,
            phrases_created,
            if decks_merged > 0 {
                format!(" ({} merged)", decks_merged)
            } else {
                String::new()
            },
            if phrases_skipped > 0 {
                format!(" ({} skipped)", phrases_skipped)
            } else {
                String::new()
            }
        )
    } else {
        "No decks imported".to_string()
    };

    Ok(DeckPackImportResult {
        success: decks_created > 0 || decks_merged > 0,
        message,
        decks_created,
        decks_merged,
        phrases_created,
        phrases_skipped,
        created_deck_ids,
    })
}

/// Get the deck source for a specific deck.
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_deck_source(deckId: i64) -> Result<Option<crate::models::DeckSource>, String> {
    let conn = get_conn()?;

    let result = conn
        .query_row(
            "SELECT id, deck_id, source_type, source_identifier, generated_at, metadata_json, created_at
             FROM deck_sources WHERE deck_id = ?1",
            params![deckId],
            |row| {
                Ok(crate::models::DeckSource {
                    id: row.get(0)?,
                    deck_id: row.get(1)?,
                    source_type: row.get(2)?,
                    source_identifier: row.get(3)?,
                    generated_at: row.get(4)?,
                    metadata_json: row.get(5)?,
                    created_at: row.get(6)?,
                })
            },
        )
        .ok();

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory database");
        init_db(&conn).expect("Failed to initialize database schema");
        conn
    }

    #[test]
    fn test_validate_deck_pack_valid() {
        let json = r#"{
            "version": 1,
            "packName": "Test Pack",
            "decks": [{
                "name": "Greetings",
                "level": "A1",
                "phrases": [
                    {"prompt": "Hello", "answer": "Hallo", "accepted": ["Hallo!"]}
                ]
            }]
        }"#;

        let result = validate_deck_pack(json.to_string()).unwrap();
        assert!(result.valid);
        assert_eq!(result.pack_name, "Test Pack");
        assert_eq!(result.deck_count, 1);
        assert_eq!(result.phrase_count, 1);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_validate_deck_pack_invalid_json() {
        let result = validate_deck_pack("not json".to_string()).unwrap();
        assert!(!result.valid);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_validate_deck_pack_empty_prompt() {
        let json = r#"{
            "version": 1,
            "packName": "Test Pack",
            "decks": [{
                "name": "Test",
                "phrases": [
                    {"prompt": "", "answer": "Hallo", "accepted": []}
                ]
            }]
        }"#;

        let result = validate_deck_pack(json.to_string()).unwrap();
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("empty prompt")));
    }

    #[test]
    fn test_parse_deck_pack() {
        let json = r#"{
            "version": 1,
            "packName": "German A1",
            "description": "Basic German vocabulary",
            "sourceUrl": "https://example.com",
            "decks": [
                {
                    "name": "Greetings",
                    "description": "Common greetings",
                    "level": "A1",
                    "category": "greetings",
                    "phrases": [
                        {"prompt": "Hello", "answer": "Hallo", "accepted": ["Hallo!"]},
                        {"prompt": "Good morning", "answer": "Guten Morgen", "accepted": []}
                    ]
                },
                {
                    "name": "Numbers",
                    "level": "A1",
                    "category": "numbers",
                    "phrases": [
                        {"prompt": "One", "answer": "Eins", "accepted": ["eins"]},
                        {"prompt": "Two", "answer": "Zwei", "accepted": []}
                    ]
                }
            ]
        }"#;

        let pack: DeckPack = serde_json::from_str(json).unwrap();
        assert_eq!(pack.version, 1);
        assert_eq!(pack.pack_name, "German A1");
        assert_eq!(pack.decks.len(), 2);
        assert_eq!(pack.decks[0].phrases.len(), 2);
        assert_eq!(pack.decks[0].level, Some("A1".to_string()));
    }
}
