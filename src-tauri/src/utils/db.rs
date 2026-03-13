//! Database utility functions for row mapping.
//!
//! This module provides shared functions to eliminate duplication in row-to-model
//! conversions across different command modules.

use crate::models::Phrase;
use rusqlite::Row;

/// Convert a database row to a Phrase model.
///
/// Expects columns in the following order:
/// 0: id, 1: prompt, 2: answer, 3: accepted_json,
/// 4: target_language, 5: native_language, 6: audio_path, 7: notes,
/// 8: starred, 9: excluded, 10: created_at, 11: material_id, 12: refined
pub fn row_to_phrase(row: &Row) -> Result<Phrase, rusqlite::Error> {
    let accepted_json: String = row.get(3)?;
    let accepted: Vec<String> = serde_json::from_str(&accepted_json).unwrap_or_default();
    let starred_int: i32 = row.get(8)?;
    let excluded_int: i32 = row.get(9).unwrap_or(0);
    let refined_int: i32 = row.get(12).unwrap_or(0);

    Ok(Phrase {
        id: row.get(0)?,
        material_id: row.get(11).ok(),
        prompt: row.get(1)?,
        answer: row.get(2)?,
        accepted,
        target_language: row.get(4)?,
        native_language: row.get(5)?,
        audio_path: row.get(6)?,
        notes: row.get(7)?,
        starred: starred_int != 0,
        excluded: excluded_int != 0,
        refined: refined_int != 0,
        created_at: row.get(10)?,
    })
}
