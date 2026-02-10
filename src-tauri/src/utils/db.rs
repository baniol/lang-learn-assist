//! Database utility functions for row mapping.
//!
//! This module provides shared functions to eliminate duplication in row-to-model
//! conversions across different command modules.

use crate::models::{LearningStatus, Phrase, PhraseProgress, PhraseWithProgress};
use rusqlite::Row;

/// Convert a database row to a Phrase model.
///
/// Expects columns in the following order:
/// 0: id, 1: prompt, 2: answer, 3: accepted_json,
/// 4: target_language, 5: native_language, 6: audio_path, 7: notes,
/// 8: starred, 9: excluded, 10: created_at, 11: material_id, 12: deck_id, 13: refined
pub fn row_to_phrase(row: &Row) -> Result<Phrase, rusqlite::Error> {
    let accepted_json: String = row.get(3)?;
    let accepted: Vec<String> = serde_json::from_str(&accepted_json).unwrap_or_default();
    let starred_int: i32 = row.get(8)?;
    let excluded_int: i32 = row.get(9).unwrap_or(0);
    let refined_int: i32 = row.get(13).unwrap_or(0);

    Ok(Phrase {
        id: row.get(0)?,
        material_id: row.get(11).ok(),
        deck_id: row.get(12).ok(),
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

/// Extract PhraseProgress from a row, starting at a given column offset.
///
/// Returns None if the progress_id column is NULL (no progress record exists).
///
/// Expected columns at offset:
/// +0: progress_id, +1: correct_streak, +2: total_attempts, +3: success_count,
/// +4: last_seen, +5: ease_factor, +6: interval_days, +7: next_review_at,
/// +8: in_srs_pool, +9: deck_correct_count, +10: learning_status
pub fn row_to_phrase_progress(row: &Row, offset: usize, phrase_id: i64) -> Option<PhraseProgress> {
    row.get::<_, Option<i64>>(offset).ok().flatten().map(|progress_id| {
        let in_srs_pool_int: i32 = row.get(offset + 8).unwrap_or(1);
        let learning_status_str: String = row.get(offset + 10).unwrap_or_else(|_| "inactive".to_string());
        PhraseProgress {
            id: progress_id,
            phrase_id,
            correct_streak: row.get(offset + 1).unwrap_or(0),
            total_attempts: row.get(offset + 2).unwrap_or(0),
            success_count: row.get(offset + 3).unwrap_or(0),
            last_seen: row.get(offset + 4).ok(),
            ease_factor: row.get(offset + 5).unwrap_or(2.5),
            interval_days: row.get(offset + 6).unwrap_or(1),
            next_review_at: row.get(offset + 7).ok(),
            learning_status: LearningStatus::from_str(&learning_status_str),
            deck_correct_count: row.get(offset + 9).unwrap_or(0),
            in_srs_pool: in_srs_pool_int != 0,
        }
    })
}

/// Convert a database row to a PhraseWithProgress model.
///
/// Expects columns:
/// - Phrase columns at indices 0-13 (id through refined)
/// - Progress columns at indices 14-24 (including in_srs_pool, deck_correct_count, learning_status)
pub fn row_to_phrase_with_progress(row: &Row) -> Result<PhraseWithProgress, rusqlite::Error> {
    let phrase = row_to_phrase(row)?;
    let progress = row_to_phrase_progress(row, 14, phrase.id);
    Ok(PhraseWithProgress { phrase, progress })
}
