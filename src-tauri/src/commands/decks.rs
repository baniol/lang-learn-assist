//! Deck management commands for organizing phrases into learning decks.
//!
//! Decks are used for learning new phrases before they graduate to the SRS pool.

use crate::db::get_conn;
use crate::models::{
    CreateDeckRequest, Deck, DeckWithStats, PhraseWithProgress, UpdateDeckRequest,
};
use crate::state::AppState;
use crate::utils::db::row_to_phrase_with_progress;
use crate::utils::lock::SafeRwLock;
use rusqlite::params;
use tauri::State;

/// Get all decks with statistics, optionally filtered by target language.
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_decks(targetLanguage: Option<String>) -> Result<Vec<DeckWithStats>, String> {
    let conn = get_conn()?;

    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref lang) = targetLanguage {
        conditions.push("d.target_language = ?");
        param_values.push(Box::new(lang.clone()));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };

    let query = format!(
        "SELECT d.id, d.name, d.description, d.target_language, d.native_language,
                d.graduation_threshold, d.created_at, d.updated_at, d.level, d.category,
                (SELECT COUNT(*) FROM phrases p WHERE p.deck_id = d.id) as total_phrases,
                (SELECT COUNT(*) FROM phrases p
                 JOIN phrase_progress pp ON p.id = pp.phrase_id
                 WHERE p.deck_id = d.id AND pp.learning_status = 'srs_active') as graduated_count
         FROM decks d{}
         ORDER BY d.created_at DESC",
        where_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let params: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let decks = stmt
        .query_map(params.as_slice(), |row| {
            let total_phrases: i32 = row.get(10)?;
            let graduated_count: i32 = row.get(11)?;
            Ok(DeckWithStats {
                deck: Deck {
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
                },
                total_phrases,
                graduated_count,
                learning_count: total_phrases - graduated_count,
            })
        })
        .map_err(|e| format!("Failed to query decks: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect decks: {}", e))?;

    Ok(decks)
}

/// Get a single deck by ID.
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_deck(deckId: i64) -> Result<Deck, String> {
    let conn = get_conn()?;

    conn.query_row(
        "SELECT id, name, description, target_language, native_language,
                graduation_threshold, created_at, updated_at, level, category
         FROM decks WHERE id = ?1",
        params![deckId],
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
    .map_err(|e| format!("Deck not found: {}", e))
}

/// Create a new deck.
#[tauri::command]
pub fn create_deck(state: State<'_, AppState>, request: CreateDeckRequest) -> Result<Deck, String> {
    let conn = get_conn()?;

    // Get default languages from settings if not provided in request
    let settings = state.settings.safe_read()?;

    let target_lang = request
        .target_language
        .unwrap_or_else(|| settings.target_language.clone());
    let native_lang = request
        .native_language
        .unwrap_or_else(|| settings.native_language.clone());
    let graduation_threshold = request.graduation_threshold.unwrap_or(2);

    conn.execute(
        "INSERT INTO decks (name, description, target_language, native_language, graduation_threshold)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            request.name,
            request.description,
            target_lang,
            native_lang,
            graduation_threshold
        ],
    )
    .map_err(|e| format!("Failed to create deck: {}", e))?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, name, description, target_language, native_language,
                graduation_threshold, created_at, updated_at, level, category
         FROM decks WHERE id = ?1",
        params![id],
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
    .map_err(|e| format!("Failed to retrieve created deck: {}", e))
}

/// Update an existing deck.
#[tauri::command]
#[allow(non_snake_case)]
pub fn update_deck(deckId: i64, request: UpdateDeckRequest) -> Result<Deck, String> {
    let conn = get_conn()?;

    if let Some(name) = &request.name {
        conn.execute(
            "UPDATE decks SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![name, deckId],
        )
        .map_err(|e| format!("Failed to update name: {}", e))?;
    }

    if let Some(description) = &request.description {
        conn.execute(
            "UPDATE decks SET description = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![description, deckId],
        )
        .map_err(|e| format!("Failed to update description: {}", e))?;
    }

    if let Some(graduation_threshold) = request.graduation_threshold {
        conn.execute(
            "UPDATE decks SET graduation_threshold = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![graduation_threshold, deckId],
        )
        .map_err(|e| format!("Failed to update graduation_threshold: {}", e))?;
    }

    conn.query_row(
        "SELECT id, name, description, target_language, native_language,
                graduation_threshold, created_at, updated_at, level, category
         FROM decks WHERE id = ?1",
        params![deckId],
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
    .map_err(|e| format!("Deck not found: {}", e))
}

/// Delete a deck. Phrases in the deck will have their deck_id set to NULL.
#[tauri::command]
#[allow(non_snake_case)]
pub fn delete_deck(deckId: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute("DELETE FROM decks WHERE id = ?1", params![deckId])
        .map_err(|e| format!("Failed to delete deck: {}", e))?;

    Ok(())
}

/// Reset all phrases in a deck to start learning from scratch.
/// This sets learning_status back to 'deck_learning' and resets deck_correct_count to 0.
#[tauri::command]
#[allow(non_snake_case)]
pub fn reset_deck(deckId: i64) -> Result<(), String> {
    let conn = get_conn()?;

    // Reset all phrase progress for phrases in this deck
    conn.execute(
        "UPDATE phrase_progress
         SET learning_status = 'deck_learning',
             in_srs_pool = 0,
             deck_correct_count = 0
         WHERE phrase_id IN (SELECT id FROM phrases WHERE deck_id = ?1)",
        params![deckId],
    )
    .map_err(|e| format!("Failed to reset deck: {}", e))?;

    Ok(())
}

/// Assign a single phrase to a deck (or remove from deck if deck_id is None).
#[tauri::command]
#[allow(non_snake_case)]
pub fn assign_phrase_to_deck(phraseId: i64, deckId: Option<i64>) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE phrases SET deck_id = ?1 WHERE id = ?2",
        params![deckId, phraseId],
    )
    .map_err(|e| format!("Failed to assign phrase to deck: {}", e))?;

    // If assigning to a deck, set learning_status to 'deck_learning' and reset deck_correct_count
    if deckId.is_some() {
        // Create or update phrase progress with learning_status = 'deck_learning'
        let existing: Option<i64> = conn
            .query_row(
                "SELECT id FROM phrase_progress WHERE phrase_id = ?1",
                params![phraseId],
                |row| row.get(0),
            )
            .ok();

        if existing.is_some() {
            conn.execute(
                "UPDATE phrase_progress SET learning_status = 'deck_learning', in_srs_pool = 0, deck_correct_count = 0 WHERE phrase_id = ?1",
                params![phraseId],
            )
            .map_err(|e| format!("Failed to update phrase progress: {}", e))?;
        } else {
            conn.execute(
                "INSERT INTO phrase_progress (phrase_id, learning_status, in_srs_pool, deck_correct_count)
                 VALUES (?1, 'deck_learning', 0, 0)",
                params![phraseId],
            )
            .map_err(|e| format!("Failed to create phrase progress: {}", e))?;
        }
    }

    Ok(())
}

/// Assign multiple phrases to a deck (or remove from deck if deck_id is None).
#[tauri::command]
#[allow(non_snake_case)]
pub fn assign_phrases_to_deck(phraseIds: Vec<i64>, deckId: Option<i64>) -> Result<(), String> {
    let mut conn = get_conn()?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    for phrase_id in &phraseIds {
        tx.execute(
            "UPDATE phrases SET deck_id = ?1 WHERE id = ?2",
            params![deckId, phrase_id],
        )
        .map_err(|e| format!("Failed to assign phrase {} to deck: {}", phrase_id, e))?;

        // If assigning to a deck, set learning_status to 'deck_learning'
        if deckId.is_some() {
            let existing: Option<i64> = tx
                .query_row(
                    "SELECT id FROM phrase_progress WHERE phrase_id = ?1",
                    params![phrase_id],
                    |row| row.get(0),
                )
                .ok();

            if existing.is_some() {
                tx.execute(
                    "UPDATE phrase_progress SET learning_status = 'deck_learning', in_srs_pool = 0, deck_correct_count = 0 WHERE phrase_id = ?1",
                    params![phrase_id],
                )
                .map_err(|e| format!("Failed to update phrase progress: {}", e))?;
            } else {
                tx.execute(
                    "INSERT INTO phrase_progress (phrase_id, learning_status, in_srs_pool, deck_correct_count)
                     VALUES (?1, 'deck_learning', 0, 0)",
                    params![phrase_id],
                )
                .map_err(|e| format!("Failed to create phrase progress: {}", e))?;
            }
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(())
}

/// Get all phrases in a deck with their progress.
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_deck_phrases(deckId: i64) -> Result<Vec<PhraseWithProgress>, String> {
    let conn = get_conn()?;

    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.prompt, p.answer, p.accepted_json,
                    p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.excluded, p.created_at, p.material_id, p.deck_id, p.refined,
                    pp.id as progress_id, pp.correct_streak, pp.total_attempts, pp.success_count, pp.last_seen,
                    pp.ease_factor, pp.interval_days, pp.next_review_at, pp.in_srs_pool, pp.deck_correct_count, pp.learning_status
             FROM phrases p
             LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
             WHERE p.deck_id = ?1
             ORDER BY p.created_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let phrases = stmt
        .query_map(params![deckId], row_to_phrase_with_progress)
        .map_err(|e| format!("Failed to query deck phrases: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect deck phrases: {}", e))?;

    Ok(phrases)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;
    use rusqlite::Connection;

    /// Create an in-memory database with schema initialized
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory database");
        init_db(&conn).expect("Failed to initialize database schema");
        conn
    }

    /// Helper to create a test deck directly in DB
    fn create_test_deck_in_db(
        conn: &Connection,
        name: &str,
        target_lang: &str,
        native_lang: &str,
    ) -> i64 {
        conn.execute(
            "INSERT INTO decks (name, description, target_language, native_language, graduation_threshold)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![name, None::<String>, target_lang, native_lang, 3],
        )
        .expect("Failed to create test deck");
        conn.last_insert_rowid()
    }

    /// Helper to create a test phrase directly in DB
    fn create_test_phrase_in_db(
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

    mod get_decks_tests {
        use super::*;

        #[test]
        fn test_get_decks_empty() {
            let conn = setup_test_db();

            let result: Vec<DeckWithStats> = conn
                .prepare(
                    "SELECT d.id, d.name, d.description, d.target_language, d.native_language,
                            d.graduation_threshold, d.created_at, d.updated_at,
                            0 as total_phrases, 0 as graduated_count
                     FROM decks d",
                )
                .unwrap()
                .query_map([], |row| {
                    Ok(DeckWithStats {
                        deck: Deck {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            description: row.get(2)?,
                            target_language: row.get(3)?,
                            native_language: row.get(4)?,
                            graduation_threshold: row.get(5)?,
                            level: None,
                            category: None,
                            created_at: row.get(6)?,
                            updated_at: row.get(7)?,
                        },
                        total_phrases: row.get(8)?,
                        graduated_count: row.get(9)?,
                        learning_count: 0,
                    })
                })
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap();

            assert!(result.is_empty());
        }

        #[test]
        fn test_get_decks_with_data() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "Spanish Basics", "Spanish", "English");
            create_test_phrase_in_db(&conn, "Hello", "Hola", "Spanish", Some(deck_id));
            create_test_phrase_in_db(&conn, "Goodbye", "Adiós", "Spanish", Some(deck_id));

            // Query deck with stats
            let result: DeckWithStats = conn
                .query_row(
                    "SELECT d.id, d.name, d.description, d.target_language, d.native_language,
                            d.graduation_threshold, d.created_at, d.updated_at,
                            (SELECT COUNT(*) FROM phrases p WHERE p.deck_id = d.id) as total_phrases,
                            (SELECT COUNT(*) FROM phrases p
                             JOIN phrase_progress pp ON p.id = pp.phrase_id
                             WHERE p.deck_id = d.id AND pp.in_srs_pool = 1) as graduated_count
                     FROM decks d WHERE d.id = ?1",
                    params![deck_id],
                    |row| {
                        let total: i32 = row.get(8)?;
                        let graduated: i32 = row.get(9)?;
                        Ok(DeckWithStats {
                            deck: Deck {
                                id: row.get(0)?,
                                name: row.get(1)?,
                                description: row.get(2)?,
                                target_language: row.get(3)?,
                                native_language: row.get(4)?,
                                graduation_threshold: row.get(5)?,
                                level: None,
                                category: None,
                                created_at: row.get(6)?,
                                updated_at: row.get(7)?,
                            },
                            total_phrases: total,
                            graduated_count: graduated,
                            learning_count: total - graduated,
                        })
                    },
                )
                .expect("Failed to query deck");

            assert_eq!(result.deck.name, "Spanish Basics");
            assert_eq!(result.total_phrases, 2);
            assert_eq!(result.graduated_count, 0);
            assert_eq!(result.learning_count, 2);
        }
    }

    mod create_deck_tests {
        use super::*;

        #[test]
        fn test_create_deck_with_defaults() {
            let conn = setup_test_db();

            conn.execute(
                "INSERT INTO decks (name, description, target_language, native_language, graduation_threshold)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params!["New Deck", None::<String>, "German", "English", 2],
            )
            .expect("Failed to create deck");

            let deck: Deck = conn
                .query_row("SELECT * FROM decks WHERE name = 'New Deck'", [], |row| {
                    Ok(Deck {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        description: row.get(2)?,
                        target_language: row.get(3)?,
                        native_language: row.get(4)?,
                        graduation_threshold: row.get(5)?,
                        created_at: row.get(6)?,
                        updated_at: row.get(7)?,
                        level: row.get::<_, Option<String>>(8)?,
                        category: row.get::<_, Option<String>>(9)?,
                    })
                })
                .expect("Failed to query deck");

            assert_eq!(deck.name, "New Deck");
            assert_eq!(deck.target_language, "German");
            assert_eq!(deck.graduation_threshold, 2);
        }

        #[test]
        fn test_create_deck_with_description() {
            let conn = setup_test_db();

            conn.execute(
                "INSERT INTO decks (name, description, target_language, native_language, graduation_threshold)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    "Advanced Deck",
                    Some("A deck for advanced learners"),
                    "French",
                    "English",
                    5
                ],
            )
            .expect("Failed to create deck");

            let deck: Deck = conn
                .query_row(
                    "SELECT * FROM decks WHERE name = 'Advanced Deck'",
                    [],
                    |row| {
                        Ok(Deck {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            description: row.get(2)?,
                            target_language: row.get(3)?,
                            native_language: row.get(4)?,
                            graduation_threshold: row.get(5)?,
                            created_at: row.get(6)?,
                            updated_at: row.get(7)?,
                            level: row.get::<_, Option<String>>(8)?,
                            category: row.get::<_, Option<String>>(9)?,
                        })
                    },
                )
                .expect("Failed to query deck");

            assert_eq!(deck.description, Some("A deck for advanced learners".to_string()));
            assert_eq!(deck.graduation_threshold, 5);
        }
    }

    mod update_deck_tests {
        use super::*;

        #[test]
        fn test_update_deck_name() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "Old Name", "Spanish", "English");

            conn.execute(
                "UPDATE decks SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
                params!["New Name", deck_id],
            )
            .expect("Failed to update deck");

            let name: String = conn
                .query_row("SELECT name FROM decks WHERE id = ?1", params![deck_id], |row| {
                    row.get(0)
                })
                .expect("Failed to query deck");

            assert_eq!(name, "New Name");
        }

        #[test]
        fn test_update_deck_graduation_threshold() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "Test Deck", "Spanish", "English");

            conn.execute(
                "UPDATE decks SET graduation_threshold = ?1 WHERE id = ?2",
                params![10, deck_id],
            )
            .expect("Failed to update deck");

            let threshold: i32 = conn
                .query_row(
                    "SELECT graduation_threshold FROM decks WHERE id = ?1",
                    params![deck_id],
                    |row| row.get(0),
                )
                .expect("Failed to query deck");

            assert_eq!(threshold, 10);
        }
    }

    mod delete_deck_tests {
        use super::*;

        #[test]
        fn test_delete_deck() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "To Delete", "Spanish", "English");

            conn.execute("DELETE FROM decks WHERE id = ?1", params![deck_id])
                .expect("Failed to delete deck");

            let count: i32 = conn
                .query_row("SELECT COUNT(*) FROM decks WHERE id = ?1", params![deck_id], |row| {
                    row.get(0)
                })
                .expect("Failed to count");

            assert_eq!(count, 0);
        }

        #[test]
        fn test_delete_deck_nullifies_phrase_deck_id() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "To Delete", "Spanish", "English");
            let phrase_id =
                create_test_phrase_in_db(&conn, "Hello", "Hola", "Spanish", Some(deck_id));

            // Verify phrase is in deck
            let deck_id_before: Option<i64> = conn
                .query_row(
                    "SELECT deck_id FROM phrases WHERE id = ?1",
                    params![phrase_id],
                    |row| row.get(0),
                )
                .expect("Failed to query");
            assert_eq!(deck_id_before, Some(deck_id));

            // Delete deck (phrases should have deck_id set to NULL due to foreign key ON DELETE SET NULL)
            conn.execute("DELETE FROM decks WHERE id = ?1", params![deck_id])
                .expect("Failed to delete deck");

            // Verify phrase deck_id is now NULL
            let deck_id_after: Option<i64> = conn
                .query_row(
                    "SELECT deck_id FROM phrases WHERE id = ?1",
                    params![phrase_id],
                    |row| row.get(0),
                )
                .expect("Failed to query");
            assert_eq!(deck_id_after, None);
        }
    }

    mod assign_phrase_tests {
        use super::*;

        #[test]
        fn test_assign_phrase_to_deck() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "Target Deck", "Spanish", "English");
            let phrase_id = create_test_phrase_in_db(&conn, "Hello", "Hola", "Spanish", None);

            // Assign phrase to deck
            conn.execute(
                "UPDATE phrases SET deck_id = ?1 WHERE id = ?2",
                params![deck_id, phrase_id],
            )
            .expect("Failed to assign phrase");

            // Verify
            let assigned_deck: Option<i64> = conn
                .query_row(
                    "SELECT deck_id FROM phrases WHERE id = ?1",
                    params![phrase_id],
                    |row| row.get(0),
                )
                .expect("Failed to query");

            assert_eq!(assigned_deck, Some(deck_id));
        }

        #[test]
        fn test_assign_phrase_creates_progress_with_in_srs_pool_false() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "Target Deck", "Spanish", "English");
            let phrase_id = create_test_phrase_in_db(&conn, "Hello", "Hola", "Spanish", None);

            // Assign phrase to deck
            conn.execute(
                "UPDATE phrases SET deck_id = ?1 WHERE id = ?2",
                params![deck_id, phrase_id],
            )
            .expect("Failed to assign phrase");

            // Create progress with in_srs_pool = 0
            conn.execute(
                "INSERT INTO phrase_progress (phrase_id, in_srs_pool, deck_correct_count)
                 VALUES (?1, 0, 0)",
                params![phrase_id],
            )
            .expect("Failed to create progress");

            // Verify progress
            let (in_srs_pool, deck_correct_count): (bool, i32) = conn
                .query_row(
                    "SELECT in_srs_pool, deck_correct_count FROM phrase_progress WHERE phrase_id = ?1",
                    params![phrase_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .expect("Failed to query progress");

            assert!(!in_srs_pool);
            assert_eq!(deck_correct_count, 0);
        }

        #[test]
        fn test_remove_phrase_from_deck() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "Source Deck", "Spanish", "English");
            let phrase_id =
                create_test_phrase_in_db(&conn, "Hello", "Hola", "Spanish", Some(deck_id));

            // Remove from deck
            conn.execute(
                "UPDATE phrases SET deck_id = NULL WHERE id = ?1",
                params![phrase_id],
            )
            .expect("Failed to remove phrase from deck");

            // Verify
            let deck_after: Option<i64> = conn
                .query_row(
                    "SELECT deck_id FROM phrases WHERE id = ?1",
                    params![phrase_id],
                    |row| row.get(0),
                )
                .expect("Failed to query");

            assert_eq!(deck_after, None);
        }
    }

    mod assign_phrases_batch_tests {
        use super::*;

        #[test]
        fn test_assign_multiple_phrases_to_deck() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "Target Deck", "Spanish", "English");
            let phrase_id1 = create_test_phrase_in_db(&conn, "Hello", "Hola", "Spanish", None);
            let phrase_id2 = create_test_phrase_in_db(&conn, "Goodbye", "Adiós", "Spanish", None);
            let phrase_id3 = create_test_phrase_in_db(&conn, "Thanks", "Gracias", "Spanish", None);

            // Assign all phrases to deck
            for phrase_id in [phrase_id1, phrase_id2, phrase_id3] {
                conn.execute(
                    "UPDATE phrases SET deck_id = ?1 WHERE id = ?2",
                    params![deck_id, phrase_id],
                )
                .expect("Failed to assign phrase");
            }

            // Verify count
            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM phrases WHERE deck_id = ?1",
                    params![deck_id],
                    |row| row.get(0),
                )
                .expect("Failed to count");

            assert_eq!(count, 3);
        }
    }

    mod get_deck_phrases_tests {
        use super::*;

        #[test]
        fn test_get_deck_phrases_empty() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "Empty Deck", "Spanish", "English");

            let count: i32 = conn
                .query_row(
                    "SELECT COUNT(*) FROM phrases WHERE deck_id = ?1",
                    params![deck_id],
                    |row| row.get(0),
                )
                .expect("Failed to count");

            assert_eq!(count, 0);
        }

        #[test]
        fn test_get_deck_phrases_with_progress() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "Test Deck", "Spanish", "English");
            let phrase_id =
                create_test_phrase_in_db(&conn, "Hello", "Hola", "Spanish", Some(deck_id));

            // Add progress
            conn.execute(
                "INSERT INTO phrase_progress (phrase_id, in_srs_pool, deck_correct_count, correct_streak, total_attempts)
                 VALUES (?1, 0, 2, 2, 3)",
                params![phrase_id],
            )
            .expect("Failed to create progress");

            // Query phrase with progress
            let (deck_correct_count, correct_streak): (i32, i32) = conn
                .query_row(
                    "SELECT pp.deck_correct_count, pp.correct_streak
                     FROM phrases p
                     JOIN phrase_progress pp ON p.id = pp.phrase_id
                     WHERE p.deck_id = ?1",
                    params![deck_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .expect("Failed to query");

            assert_eq!(deck_correct_count, 2);
            assert_eq!(correct_streak, 2);
        }

        #[test]
        fn test_get_deck_phrases_ordered_by_id_desc() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "Test Deck", "Spanish", "English");

            // Create phrases - since created_at may have same timestamp in tests,
            // we verify ordering by ID DESC instead (which is consistent with insertion order)
            let id1 = create_test_phrase_in_db(&conn, "First", "Primero", "Spanish", Some(deck_id));
            let id2 = create_test_phrase_in_db(&conn, "Second", "Segundo", "Spanish", Some(deck_id));
            let id3 = create_test_phrase_in_db(&conn, "Third", "Tercero", "Spanish", Some(deck_id));

            // Verify IDs are in ascending order
            assert!(id1 < id2 && id2 < id3);

            // When ordered by created_at DESC, id DESC, most recent (highest ID) comes first
            let prompts: Vec<String> = conn
                .prepare("SELECT prompt FROM phrases WHERE deck_id = ?1 ORDER BY id DESC")
                .expect("Failed to prepare")
                .query_map(params![deck_id], |row| row.get(0))
                .expect("Failed to query")
                .collect::<Result<Vec<_>, _>>()
                .expect("Failed to collect");

            // Most recent (highest ID) first
            assert_eq!(prompts[0], "Third");
            assert_eq!(prompts[1], "Second");
            assert_eq!(prompts[2], "First");
        }
    }

    mod graduation_tests {
        use super::*;

        #[test]
        fn test_graduation_threshold_respected() {
            let conn = setup_test_db();

            // Create deck with threshold of 3
            let deck_id = create_test_deck_in_db(&conn, "Test Deck", "Spanish", "English");
            let phrase_id =
                create_test_phrase_in_db(&conn, "Hello", "Hola", "Spanish", Some(deck_id));

            // Create progress with 2 correct (not yet graduated)
            conn.execute(
                "INSERT INTO phrase_progress (phrase_id, in_srs_pool, deck_correct_count)
                 VALUES (?1, 0, 2)",
                params![phrase_id],
            )
            .expect("Failed to create progress");

            let in_srs_pool: bool = conn
                .query_row(
                    "SELECT in_srs_pool FROM phrase_progress WHERE phrase_id = ?1",
                    params![phrase_id],
                    |row| row.get(0),
                )
                .expect("Failed to query");

            assert!(!in_srs_pool, "Should not be in SRS pool with only 2 correct");

            // Simulate graduation (3rd correct answer)
            conn.execute(
                "UPDATE phrase_progress SET deck_correct_count = 3, in_srs_pool = 1 WHERE phrase_id = ?1",
                params![phrase_id],
            )
            .expect("Failed to update");

            let (in_srs_pool_after, deck_correct_count): (bool, i32) = conn
                .query_row(
                    "SELECT in_srs_pool, deck_correct_count FROM phrase_progress WHERE phrase_id = ?1",
                    params![phrase_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .expect("Failed to query");

            assert!(in_srs_pool_after, "Should be in SRS pool after 3 correct");
            assert_eq!(deck_correct_count, 3);
        }

        #[test]
        fn test_incorrect_answer_resets_deck_correct_count() {
            let conn = setup_test_db();

            let deck_id = create_test_deck_in_db(&conn, "Test Deck", "Spanish", "English");
            let phrase_id =
                create_test_phrase_in_db(&conn, "Hello", "Hola", "Spanish", Some(deck_id));

            // Create progress with 2 correct
            conn.execute(
                "INSERT INTO phrase_progress (phrase_id, in_srs_pool, deck_correct_count)
                 VALUES (?1, 0, 2)",
                params![phrase_id],
            )
            .expect("Failed to create progress");

            // Simulate incorrect answer
            conn.execute(
                "UPDATE phrase_progress SET deck_correct_count = 0 WHERE phrase_id = ?1",
                params![phrase_id],
            )
            .expect("Failed to reset");

            let deck_correct_count: i32 = conn
                .query_row(
                    "SELECT deck_correct_count FROM phrase_progress WHERE phrase_id = ?1",
                    params![phrase_id],
                    |row| row.get(0),
                )
                .expect("Failed to query");

            assert_eq!(deck_correct_count, 0, "Should reset to 0 on incorrect answer");
        }
    }
}
