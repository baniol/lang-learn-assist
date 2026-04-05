//! Database utility functions for row mapping.
//!
//! This module provides shared functions to eliminate duplication in row-to-model
//! conversions across different command modules.

/// SELECT columns for a phrase row (aliased table `p`), matching `row_to_phrase` column order.
pub const PHRASE_COLUMNS: &str =
    "p.id, p.prompt, p.answer, p.accepted_json, p.target_language, p.native_language, \
     p.audio_path, p.notes, p.starred, p.created_at, p.material_id, p.refined";

/// SELECT columns for a material row (no alias), matching `row_to_material` column order.
pub const MATERIAL_COLUMNS: &str =
    "id, title, material_type, source_url, original_text, segments_json, \
     target_language, native_language, status, bookmark_index, created_at, updated_at";

use crate::models::{
    Material, MaterialThread, MaterialThreadMessage, Phrase, PhraseThread, PhraseThreadMessage,
    SuggestedPhrase, Tag,
};
use rusqlite::Row;

/// Convert a database row to a Phrase model.
///
/// Expects columns in the following order:
/// 0: id, 1: prompt, 2: answer, 3: accepted_json,
/// 4: target_language, 5: native_language, 6: audio_path, 7: notes,
/// 8: starred, 9: created_at, 10: material_id, 11: refined
pub fn row_to_phrase(row: &Row) -> Result<Phrase, rusqlite::Error> {
    let accepted_json: String = row.get(3)?;
    let accepted: Vec<String> = serde_json::from_str(&accepted_json).unwrap_or_default();
    let starred_int: i32 = row.get(8)?;
    let refined_int: i32 = row.get(11).unwrap_or(0);

    Ok(Phrase {
        id: row.get(0)?,
        material_id: row.get(10).ok(),
        prompt: row.get(1)?,
        answer: row.get(2)?,
        accepted,
        target_language: row.get(4)?,
        native_language: row.get(5)?,
        audio_path: row.get(6)?,
        notes: row.get(7)?,
        starred: starred_int != 0,
        refined: refined_int != 0,
        created_at: row.get(9)?,
    })
}

/// Convert a database row to a Tag model.
///
/// Expects columns: 0: id, 1: name, 2: target_language, 3: created_at
pub fn row_to_tag(row: &Row) -> Result<Tag, rusqlite::Error> {
    Ok(Tag {
        id: row.get(0)?,
        name: row.get(1)?,
        target_language: row.get(2)?,
        created_at: row.get(3)?,
    })
}

/// Convert a database row to a Material model.
///
/// Expects columns: 0: id, 1: title, 2: material_type, 3: source_url, 4: original_text,
/// 5: segments_json, 6: target_language, 7: native_language, 8: status,
/// 9: bookmark_index, 10: created_at, 11: updated_at
pub fn row_to_material(row: &Row) -> Result<Material, rusqlite::Error> {
    Ok(Material {
        id: row.get(0)?,
        title: row.get(1)?,
        material_type: row.get(2)?,
        source_url: row.get(3)?,
        original_text: row.get(4)?,
        segments_json: row.get(5)?,
        target_language: row.get(6)?,
        native_language: row.get(7)?,
        status: row.get(8)?,
        bookmark_index: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

/// Convert a database row to a PhraseThread model.
///
/// Expects columns: 0: id, 1: phrase_id, 2: messages_json, 3: suggested_prompt,
/// 4: suggested_answer, 5: suggested_accepted_json, 6: status, 7: created_at, 8: updated_at
pub fn row_to_phrase_thread(row: &Row) -> Result<PhraseThread, rusqlite::Error> {
    let messages_json: String = row.get(2)?;
    let messages: Vec<PhraseThreadMessage> =
        serde_json::from_str(&messages_json).unwrap_or_default();
    let suggested_accepted_json: Option<String> = row.get(5)?;
    let suggested_accepted: Option<Vec<String>> =
        suggested_accepted_json.and_then(|j| serde_json::from_str(&j).ok());

    Ok(PhraseThread {
        id: row.get(0)?,
        phrase_id: row.get(1)?,
        messages,
        suggested_prompt: row.get(3)?,
        suggested_answer: row.get(4)?,
        suggested_accepted,
        status: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

/// Convert a database row to a MaterialThread model.
///
/// Expects columns: 0: id, 1: material_id, 2: segment_index, 3: messages_json,
/// 4: suggested_phrases_json, 5: created_at, 6: updated_at
pub fn row_to_material_thread(row: &Row) -> Result<MaterialThread, rusqlite::Error> {
    let messages_json: String = row.get(3)?;
    let messages: Vec<MaterialThreadMessage> =
        serde_json::from_str(&messages_json).unwrap_or_default();
    let suggested_phrases_json: Option<String> = row.get(4)?;
    let suggested_phrases: Option<Vec<SuggestedPhrase>> =
        suggested_phrases_json.and_then(|j| serde_json::from_str(&j).ok());

    Ok(MaterialThread {
        id: row.get(0)?,
        material_id: row.get(1)?,
        segment_index: row.get(2)?,
        messages,
        suggested_phrases,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}
