//! Phrase selection logic for learning sessions.
//!
//! This module handles selecting the next phrase to show based on SRS priorities.

use crate::constants::priority::NEW_PHRASE;
use crate::db::get_conn;
use crate::models::PhraseWithProgress;
use crate::utils::db::row_to_phrase_with_progress;

use super::srs::calculate_priority;

/// Get the next phrase to practice based on SRS scheduling.
///
/// Prioritizes:
/// 1. If session_position % new_phrase_interval == 0, prefer a new phrase (interleaving)
/// 2. Otherwise: overdue phrases (most overdue first)
/// 3. New phrases (up to new_phrase_limit)
/// 4. Skips phrases not yet due for review
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_next_phrase(
    target_language: Option<String>,
    exclude_ids: Option<Vec<i64>>,
    new_phrase_count: Option<i32>,
    new_phrase_limit: Option<i32>,
    sessionPosition: Option<i32>,
    newPhraseInterval: Option<i32>,
) -> Result<Option<PhraseWithProgress>, String> {
    let conn = get_conn()?;

    // Build query with parameter placeholders
    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // Always exclude phrases marked as excluded
    conditions.push("(p.excluded = 0 OR p.excluded IS NULL)".to_string());

    if let Some(ref lang) = target_language {
        conditions.push("p.target_language = ?".to_string());
        param_values.push(Box::new(lang.clone()));
    }

    // For exclude_ids, we build placeholders dynamically but values are still parameterized
    if let Some(ref ids) = exclude_ids {
        if !ids.is_empty() {
            let placeholders: Vec<&str> = ids.iter().map(|_| "?").collect();
            conditions.push(format!("p.id NOT IN ({})", placeholders.join(",")));
            for id in ids {
                param_values.push(Box::new(*id));
            }
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" AND {}", conditions.join(" AND "))
    };

    let query = format!(
        "SELECT p.id, p.conversation_id, p.prompt, p.answer, p.accepted_json,
                p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.excluded, p.created_at, p.material_id,
                pp.id as progress_id, pp.correct_streak, pp.total_attempts, pp.success_count, pp.last_seen,
                pp.ease_factor, pp.interval_days, pp.next_review_at
         FROM phrases p
         LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
         WHERE 1=1{}",
        where_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let params: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let phrases: Vec<PhraseWithProgress> = stmt
        .query_map(params.as_slice(), row_to_phrase_with_progress)
        .map_err(|e| format!("Failed to query phrases: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect phrases: {}", e))?;

    if phrases.is_empty() {
        return Ok(None);
    }

    // Check if we've hit the new phrase limit
    let current_new_count = new_phrase_count.unwrap_or(0);
    let max_new_phrases = new_phrase_limit.unwrap_or(0);
    let limit_new_phrases = max_new_phrases > 0 && current_new_count >= max_new_phrases;

    // Check if this is an interleave turn (time for a new phrase)
    let position = sessionPosition.unwrap_or(0);
    let interval = newPhraseInterval.unwrap_or(4);
    let is_interleave_turn = interval > 0 && position > 0 && position % interval == 0;

    // Calculate priorities
    let mut phrases_with_priority: Vec<(PhraseWithProgress, f64)> = phrases
        .into_iter()
        .map(|p| {
            let mut priority = calculate_priority(&p.progress);
            let is_new = (priority - NEW_PHRASE).abs() < 0.001;

            // If we've hit the new phrase limit, skip new phrases
            if limit_new_phrases && is_new {
                priority = 0.0;
            }

            (p, priority)
        })
        .collect();

    // Sort by priority descending
    phrases_with_priority.sort_by(|a, b| {
        b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal)
    });

    // If it's an interleave turn and we haven't hit the limit, prefer a new phrase
    if is_interleave_turn && !limit_new_phrases {
        let new_phrase = phrases_with_priority
            .iter()
            .find(|(_, priority)| (*priority - NEW_PHRASE).abs() < 0.001)
            .map(|(phrase, _)| phrase.clone());

        if new_phrase.is_some() {
            return Ok(new_phrase);
        }
        // If no new phrases available, fall through to normal selection
    }

    // Normal selection: highest priority phrase (due for review or new)
    // Phrases not yet due (priority 0) should NOT be shown - that's the point of SRS
    let next_phrase = phrases_with_priority
        .iter()
        .find(|(_, priority)| *priority > 0.0)
        .map(|(phrase, _)| phrase.clone());

    Ok(next_phrase)
}
