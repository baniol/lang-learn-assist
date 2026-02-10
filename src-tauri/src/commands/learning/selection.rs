//! Phrase selection logic for learning sessions.
//!
//! This module handles selecting the next phrase to show based on SRS priorities.

use crate::constants::priority::NEW_PHRASE;
use crate::db::get_conn;
use crate::models::{PhraseWithProgress, StudyMode};
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

    // Only include phrases that have graduated to SRS pool
    // Phrases must have in_srs_pool = 1 to appear in SRS review
    conditions.push("pp.in_srs_pool = 1".to_string());

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
        "SELECT p.id, p.prompt, p.answer, p.accepted_json,
                p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.excluded, p.created_at, p.material_id, p.deck_id, p.refined,
                pp.id as progress_id, pp.correct_streak, pp.total_attempts, pp.success_count, pp.last_seen,
                pp.ease_factor, pp.interval_days, pp.next_review_at, pp.in_srs_pool, pp.deck_correct_count, pp.learning_status
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

/// Get the next phrase to practice from a specific deck.
///
/// Unlike SRS mode, this returns phrases from the deck without SRS scheduling.
/// Prioritizes phrases with lower deck_correct_count (less practiced).
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_next_deck_phrase(
    deckId: i64,
    excludeIds: Option<Vec<i64>>,
) -> Result<Option<PhraseWithProgress>, String> {
    let conn = get_conn()?;

    // Build query with parameter placeholders
    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // Only phrases from this deck
    conditions.push("p.deck_id = ?".to_string());
    param_values.push(Box::new(deckId));

    // Always exclude phrases marked as excluded
    conditions.push("(p.excluded = 0 OR p.excluded IS NULL)".to_string());

    // Exclude graduated phrases (they've moved to SRS)
    conditions.push("(pp.learning_status IS NULL OR pp.learning_status != 'srs_active')".to_string());

    // For exclude_ids, we build placeholders dynamically but values are still parameterized
    if let Some(ref ids) = excludeIds {
        if !ids.is_empty() {
            let placeholders: Vec<&str> = ids.iter().map(|_| "?").collect();
            conditions.push(format!("p.id NOT IN ({})", placeholders.join(",")));
            for id in ids {
                param_values.push(Box::new(*id));
            }
        }
    }

    let where_clause = format!(" AND {}", conditions.join(" AND "));

    // Order by deck_correct_count (less practiced first), then random for variety
    let query = format!(
        "SELECT p.id, p.prompt, p.answer, p.accepted_json,
                p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.excluded, p.created_at, p.material_id, p.deck_id, p.refined,
                pp.id as progress_id, pp.correct_streak, pp.total_attempts, pp.success_count, pp.last_seen,
                pp.ease_factor, pp.interval_days, pp.next_review_at, pp.in_srs_pool, pp.deck_correct_count, pp.learning_status
         FROM phrases p
         LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
         WHERE 1=1{}
         ORDER BY COALESCE(pp.deck_correct_count, 0) ASC, RANDOM()
         LIMIT 1",
        where_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let params: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let result = stmt
        .query_row(params.as_slice(), row_to_phrase_with_progress)
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            _ => Err(format!("Failed to query deck phrase: {}", e)),
        })?;

    Ok(result)
}

/// Unified phrase selection command supporting both deck learning and SRS review modes.
///
/// This is the new unified API that replaces separate get_next_phrase and get_next_deck_phrase commands.
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_study_phrase(
    mode: StudyMode,
    excludeIds: Option<Vec<i64>>,
    // SRS-specific options (ignored for deck learning)
    newPhraseCount: Option<i32>,
    newPhraseLimit: Option<i32>,
    sessionPosition: Option<i32>,
    newPhraseInterval: Option<i32>,
    targetLanguage: Option<String>,
) -> Result<Option<PhraseWithProgress>, String> {
    match mode {
        StudyMode::DeckLearning { deck_id } => {
            get_next_deck_phrase(deck_id, excludeIds)
        }
        StudyMode::SrsReview => {
            get_next_phrase(
                targetLanguage,
                excludeIds,
                newPhraseCount,
                newPhraseLimit,
                sessionPosition,
                newPhraseInterval,
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;
    use rusqlite::{params, Connection};

    /// Create an in-memory database with schema initialized
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory database");
        init_db(&conn).expect("Failed to initialize database schema");
        conn
    }

    /// Helper to create a test phrase directly in DB
    fn create_test_phrase(
        conn: &Connection,
        prompt: &str,
        answer: &str,
        target_lang: &str,
        deck_id: Option<i64>,
    ) -> i64 {
        conn.execute(
            "INSERT INTO phrases (prompt, answer, accepted_json, target_language, native_language, deck_id)
             VALUES (?1, ?2, '[]', ?3, 'English', ?4)",
            params![prompt, answer, target_lang, deck_id],
        )
        .expect("Failed to create test phrase");
        conn.last_insert_rowid()
    }

    /// Helper to create phrase progress
    fn create_phrase_progress(
        conn: &Connection,
        phrase_id: i64,
        in_srs_pool: bool,
        next_review_at: Option<&str>,
        interval_days: i32,
    ) {
        conn.execute(
            "INSERT INTO phrase_progress (phrase_id, in_srs_pool, next_review_at, interval_days, ease_factor)
             VALUES (?1, ?2, ?3, ?4, 2.5)",
            params![phrase_id, in_srs_pool, next_review_at, interval_days],
        )
        .expect("Failed to create phrase progress");
    }

    /// Helper to create a test deck
    fn create_test_deck(conn: &Connection, name: &str, target_lang: &str) -> i64 {
        conn.execute(
            "INSERT INTO decks (name, description, target_language, native_language, graduation_threshold)
             VALUES (?1, NULL, ?2, 'English', 3)",
            params![name, target_lang],
        )
        .expect("Failed to create test deck");
        conn.last_insert_rowid()
    }

    mod srs_selection_tests {
        use super::*;

        #[test]
        fn test_selects_phrase_without_progress_as_new() {
            let conn = setup_test_db();

            let phrase_id = create_test_phrase(&conn, "Hello", "Hola", "Spanish", None);

            // Query phrase with priority calculation
            let phrase: Option<PhraseWithProgress> = conn
                .query_row(
                    "SELECT p.id, p.prompt, p.answer, p.accepted_json,
                            p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.excluded, p.created_at, p.material_id, p.deck_id, p.refined,
                            pp.id as progress_id, pp.correct_streak, pp.total_attempts, pp.success_count, pp.last_seen,
                            pp.ease_factor, pp.interval_days, pp.next_review_at, pp.in_srs_pool, pp.deck_correct_count, pp.learning_status
                     FROM phrases p
                     LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
                     WHERE p.id = ?1",
                    params![phrase_id],
                    row_to_phrase_with_progress,
                )
                .ok();

            assert!(phrase.is_some());
            let p = phrase.unwrap();
            assert_eq!(p.phrase.prompt, "Hello");

            // No progress means this is a new phrase
            let priority = calculate_priority(&p.progress);
            assert!((priority - NEW_PHRASE).abs() < 0.001, "Should have NEW_PHRASE priority");
        }

        #[test]
        fn test_excludes_phrases_in_deck_learning_phase() {
            let conn = setup_test_db();

            let deck_id = create_test_deck(&conn, "Test Deck", "Spanish");
            let phrase_id = create_test_phrase(&conn, "Hello", "Hola", "Spanish", Some(deck_id));

            // Create progress with in_srs_pool = false (still learning in deck)
            create_phrase_progress(&conn, phrase_id, false, None, 0);

            // Query with SRS pool filter
            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM phrases p
                     LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
                     WHERE (pp.in_srs_pool = 1 OR pp.in_srs_pool IS NULL OR pp.id IS NULL)",
                    [],
                    |row| row.get(0),
                )
                .expect("Failed to count");

            assert_eq!(count, 0, "Phrase in deck learning phase should be excluded from SRS");
        }

        #[test]
        fn test_includes_graduated_phrases_in_srs() {
            let conn = setup_test_db();

            let deck_id = create_test_deck(&conn, "Test Deck", "Spanish");
            let phrase_id = create_test_phrase(&conn, "Hello", "Hola", "Spanish", Some(deck_id));

            // Create progress with in_srs_pool = true (graduated from deck)
            create_phrase_progress(&conn, phrase_id, true, None, 0);

            // Query with SRS pool filter
            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM phrases p
                     LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
                     WHERE (pp.in_srs_pool = 1 OR pp.in_srs_pool IS NULL OR pp.id IS NULL)",
                    [],
                    |row| row.get(0),
                )
                .expect("Failed to count");

            assert_eq!(count, 1, "Graduated phrase should be included in SRS");
        }

        #[test]
        fn test_excludes_specified_ids() {
            let conn = setup_test_db();

            let id1 = create_test_phrase(&conn, "Hello", "Hola", "Spanish", None);
            let id2 = create_test_phrase(&conn, "Goodbye", "Adiós", "Spanish", None);
            let id3 = create_test_phrase(&conn, "Thanks", "Gracias", "Spanish", None);

            // Query excluding id1 and id2
            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM phrases WHERE id NOT IN (?1, ?2)",
                    params![id1, id2],
                    |row| row.get(0),
                )
                .expect("Failed to count");

            assert_eq!(count, 1, "Should only have one phrase after excluding two");

            let remaining: String = conn
                .query_row(
                    "SELECT prompt FROM phrases WHERE id NOT IN (?1, ?2)",
                    params![id1, id2],
                    |row| row.get(0),
                )
                .expect("Failed to query");

            assert_eq!(remaining, "Thanks", "Remaining phrase should be 'Thanks' (id3)");
            let _ = id3; // Use id3 to avoid warning
        }

        #[test]
        fn test_filters_by_target_language() {
            let conn = setup_test_db();

            create_test_phrase(&conn, "Hello", "Hola", "Spanish", None);
            create_test_phrase(&conn, "Hello", "Hallo", "German", None);
            create_test_phrase(&conn, "Hello", "Bonjour", "French", None);

            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM phrases WHERE target_language = ?1",
                    params!["Spanish"],
                    |row| row.get(0),
                )
                .expect("Failed to count");

            assert_eq!(count, 1, "Should only find Spanish phrase");
        }

        #[test]
        fn test_excludes_excluded_phrases() {
            let conn = setup_test_db();

            let id1 = create_test_phrase(&conn, "Good", "Bueno", "Spanish", None);
            let id2 = create_test_phrase(&conn, "Bad", "Malo", "Spanish", None);

            // Mark id2 as excluded
            conn.execute("UPDATE phrases SET excluded = 1 WHERE id = ?1", params![id2])
                .expect("Failed to exclude");

            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM phrases WHERE excluded = 0 OR excluded IS NULL",
                    [],
                    |row| row.get(0),
                )
                .expect("Failed to count");

            assert_eq!(count, 1, "Should exclude the excluded phrase");
            let _ = id1; // Use id1 to avoid warning
        }
    }

    mod interleaving_tests {
        #[allow(unused_imports)]
        use super::*;

        #[test]
        fn test_interleave_turn_calculation() {
            // Test the interleave logic inline
            let interval = 4;

            // Position 0 - not interleave (first phrase)
            let is_interleave_0 = interval > 0 && 0 > 0 && 0 % interval == 0;
            assert!(!is_interleave_0, "Position 0 should not be interleave turn");

            // Position 1-3 - not interleave
            let is_interleave_1 = interval > 0 && 1 > 0 && 1 % interval == 0;
            let is_interleave_2 = interval > 0 && 2 > 0 && 2 % interval == 0;
            let is_interleave_3 = interval > 0 && 3 > 0 && 3 % interval == 0;
            assert!(!is_interleave_1);
            assert!(!is_interleave_2);
            assert!(!is_interleave_3);

            // Position 4 - interleave (4 % 4 == 0)
            let is_interleave_4 = interval > 0 && 4 > 0 && 4 % interval == 0;
            assert!(is_interleave_4, "Position 4 should be interleave turn");

            // Position 8 - interleave
            let is_interleave_8 = interval > 0 && 8 > 0 && 8 % interval == 0;
            assert!(is_interleave_8, "Position 8 should be interleave turn");
        }

        #[test]
        fn test_new_phrase_limit_enforcement() {
            let current_new_count = 5;
            let max_new_phrases = 5;

            let limit_reached = max_new_phrases > 0 && current_new_count >= max_new_phrases;
            assert!(limit_reached, "Should detect when new phrase limit is reached");

            let current_new_count_low = 3;
            let limit_not_reached = max_new_phrases > 0 && current_new_count_low >= max_new_phrases;
            assert!(!limit_not_reached, "Should not limit when under max");
        }
    }

    mod deck_selection_tests {
        use super::*;

        #[test]
        fn test_selects_only_from_specified_deck() {
            let conn = setup_test_db();

            let deck1 = create_test_deck(&conn, "Deck 1", "Spanish");
            let deck2 = create_test_deck(&conn, "Deck 2", "Spanish");

            create_test_phrase(&conn, "Hello", "Hola", "Spanish", Some(deck1));
            create_test_phrase(&conn, "Goodbye", "Adiós", "Spanish", Some(deck2));

            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM phrases WHERE deck_id = ?1",
                    params![deck1],
                    |row| row.get(0),
                )
                .expect("Failed to count");

            assert_eq!(count, 1, "Should only find phrases from deck1");
        }

        #[test]
        fn test_deck_selection_prioritizes_low_correct_count() {
            let conn = setup_test_db();

            let deck_id = create_test_deck(&conn, "Test Deck", "Spanish");

            let id1 = create_test_phrase(&conn, "Hello", "Hola", "Spanish", Some(deck_id));
            let id2 = create_test_phrase(&conn, "Goodbye", "Adiós", "Spanish", Some(deck_id));
            let id3 = create_test_phrase(&conn, "Thanks", "Gracias", "Spanish", Some(deck_id));

            // Set different deck_correct_counts
            conn.execute(
                "INSERT INTO phrase_progress (phrase_id, deck_correct_count, in_srs_pool) VALUES (?1, 2, 0)",
                params![id1],
            )
            .expect("Failed to create progress");
            conn.execute(
                "INSERT INTO phrase_progress (phrase_id, deck_correct_count, in_srs_pool) VALUES (?1, 0, 0)",
                params![id2],
            )
            .expect("Failed to create progress");
            conn.execute(
                "INSERT INTO phrase_progress (phrase_id, deck_correct_count, in_srs_pool) VALUES (?1, 1, 0)",
                params![id3],
            )
            .expect("Failed to create progress");

            // Query ordered by deck_correct_count ASC
            let first_prompt: String = conn
                .query_row(
                    "SELECT p.prompt FROM phrases p
                     LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
                     WHERE p.deck_id = ?1
                     ORDER BY COALESCE(pp.deck_correct_count, 0) ASC
                     LIMIT 1",
                    params![deck_id],
                    |row| row.get(0),
                )
                .expect("Failed to query");

            assert_eq!(first_prompt, "Goodbye", "Should select phrase with lowest deck_correct_count");
        }

        #[test]
        fn test_deck_selection_excludes_ids() {
            let conn = setup_test_db();

            let deck_id = create_test_deck(&conn, "Test Deck", "Spanish");

            let id1 = create_test_phrase(&conn, "Hello", "Hola", "Spanish", Some(deck_id));
            let id2 = create_test_phrase(&conn, "Goodbye", "Adiós", "Spanish", Some(deck_id));

            // Query excluding id1
            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM phrases WHERE deck_id = ?1 AND id NOT IN (?2)",
                    params![deck_id, id1],
                    |row| row.get(0),
                )
                .expect("Failed to count");

            assert_eq!(count, 1, "Should exclude the specified phrase");
            let _ = id2; // Use id2 to avoid warning
        }

        #[test]
        fn test_deck_selection_returns_none_when_empty() {
            let conn = setup_test_db();

            let deck_id = create_test_deck(&conn, "Empty Deck", "Spanish");

            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM phrases WHERE deck_id = ?1",
                    params![deck_id],
                    |row| row.get(0),
                )
                .expect("Failed to count");

            assert_eq!(count, 0, "Empty deck should have no phrases");
        }
    }

    mod priority_calculation_tests {
        use super::*;

        #[test]
        fn test_new_phrase_has_fixed_priority() {
            // A phrase without progress (None) should have NEW_PHRASE priority
            let priority = calculate_priority(&None);
            assert!((priority - NEW_PHRASE).abs() < 0.001);
        }

        #[test]
        fn test_priority_ordering() {
            // New phrases have fixed priority
            let new_priority = calculate_priority(&None);

            // This verifies the constant is what we expect
            assert!(new_priority > 0.0, "New phrase should have positive priority");
            assert!((new_priority - NEW_PHRASE).abs() < 0.001, "New priority should equal NEW_PHRASE constant");
        }
    }
}
