use crate::db::get_conn;
use crate::models::{
    CreatePhraseRequest, Phrase, PhraseProgress, PhraseWithProgress, UpdatePhraseRequest,
};
use rusqlite::params;

fn row_to_phrase(row: &rusqlite::Row) -> Result<Phrase, rusqlite::Error> {
    let accepted_json: String = row.get(4)?;
    let accepted: Vec<String> = serde_json::from_str(&accepted_json).unwrap_or_default();
    let starred_int: i32 = row.get(9)?;

    Ok(Phrase {
        id: row.get(0)?,
        conversation_id: row.get(1)?,
        prompt: row.get(2)?,
        answer: row.get(3)?,
        accepted,
        target_language: row.get(5)?,
        native_language: row.get(6)?,
        audio_path: row.get(7)?,
        notes: row.get(8)?,
        starred: starred_int != 0,
        created_at: row.get(10)?,
    })
}

/// Status filter for phrase queries
/// - "all": no filtering
/// - "new": phrases with no progress
/// - "learning": phrases with progress but streak < 2
/// - "learned": phrases with streak >= 2
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_phrases(
    conversationId: Option<i64>,
    starredOnly: Option<bool>,
    targetLanguage: Option<String>,
    status: Option<String>,
    searchQuery: Option<String>,
) -> Result<Vec<PhraseWithProgress>, String> {
    let conn = get_conn()?;

    // Build query with parameter placeholders
    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(cid) = conversationId {
        conditions.push("p.conversation_id = ?");
        param_values.push(Box::new(cid));
    }

    if starredOnly.unwrap_or(false) {
        conditions.push("p.starred = 1");
    }

    if let Some(ref lang) = targetLanguage {
        conditions.push("p.target_language = ?");
        param_values.push(Box::new(lang.clone()));
    }

    // Status filtering based on progress
    if let Some(ref status_filter) = status {
        match status_filter.as_str() {
            "new" => {
                conditions.push("pp.id IS NULL");
            }
            "learning" => {
                conditions.push("pp.id IS NOT NULL AND pp.total_attempts > 0 AND pp.correct_streak < 2");
            }
            "learned" => {
                conditions.push("pp.id IS NOT NULL AND pp.correct_streak >= 2");
            }
            _ => {} // "all" or any other value means no filtering
        }
    }

    // Search filter
    if let Some(ref query) = searchQuery {
        if !query.is_empty() {
            conditions.push("(p.prompt LIKE ? OR p.answer LIKE ?)");
            let search_pattern = format!("%{}%", query);
            param_values.push(Box::new(search_pattern.clone()));
            param_values.push(Box::new(search_pattern));
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" AND {}", conditions.join(" AND "))
    };

    let query = format!(
        "SELECT p.id, p.conversation_id, p.prompt, p.answer, p.accepted_json,
                p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.created_at,
                pp.id as progress_id, pp.correct_streak, pp.total_attempts, pp.success_count, pp.last_seen
         FROM phrases p
         LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
         WHERE 1=1{}
         ORDER BY p.created_at DESC",
        where_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let params: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let phrases = stmt
        .query_map(params.as_slice(), |row| {
            let phrase = row_to_phrase(row)?;

            let progress = if let Ok(progress_id) = row.get::<_, i64>(11) {
                Some(PhraseProgress {
                    id: progress_id,
                    phrase_id: phrase.id,
                    correct_streak: row.get(12)?,
                    total_attempts: row.get(13)?,
                    success_count: row.get(14)?,
                    last_seen: row.get(15)?,
                })
            } else {
                None
            };

            Ok(PhraseWithProgress { phrase, progress })
        })
        .map_err(|e| format!("Failed to query phrases: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect phrases: {}", e))?;

    Ok(phrases)
}

#[tauri::command]
pub fn get_phrase(id: i64) -> Result<PhraseWithProgress, String> {
    let conn = get_conn()?;

    conn.query_row(
        "SELECT p.id, p.conversation_id, p.prompt, p.answer, p.accepted_json,
                p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.created_at,
                pp.id as progress_id, pp.correct_streak, pp.total_attempts, pp.success_count, pp.last_seen
         FROM phrases p
         LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
         WHERE p.id = ?1",
        params![id],
        |row| {
            let phrase = row_to_phrase(row)?;

            let progress = if let Ok(progress_id) = row.get::<_, i64>(11) {
                Some(PhraseProgress {
                    id: progress_id,
                    phrase_id: phrase.id,
                    correct_streak: row.get(12)?,
                    total_attempts: row.get(13)?,
                    success_count: row.get(14)?,
                    last_seen: row.get(15)?,
                })
            } else {
                None
            };

            Ok(PhraseWithProgress { phrase, progress })
        },
    )
    .map_err(|e| format!("Phrase not found: {}", e))
}

#[tauri::command]
pub fn create_phrase(request: CreatePhraseRequest) -> Result<Phrase, String> {
    let conn = get_conn()?;

    let accepted_json = serde_json::to_string(&request.accepted.unwrap_or_default())
        .map_err(|e| format!("Failed to serialize accepted: {}", e))?;

    let target_lang = request
        .target_language
        .unwrap_or_else(|| "de".to_string());
    let native_lang = request
        .native_language
        .unwrap_or_else(|| "pl".to_string());

    conn.execute(
        "INSERT INTO phrases (conversation_id, prompt, answer, accepted_json, target_language, native_language, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            request.conversation_id,
            request.prompt,
            request.answer,
            accepted_json,
            target_lang,
            native_lang,
            request.notes
        ],
    )
    .map_err(|e| format!("Failed to create phrase: {}", e))?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, conversation_id, prompt, answer, accepted_json, target_language, native_language, audio_path, notes, starred, created_at
         FROM phrases WHERE id = ?1",
        params![id],
        row_to_phrase,
    )
    .map_err(|e| format!("Failed to retrieve created phrase: {}", e))
}

#[tauri::command]
pub fn create_phrases_batch(phrases: Vec<CreatePhraseRequest>) -> Result<Vec<Phrase>, String> {
    let mut conn = get_conn()?;

    // Use transaction for atomicity - all phrases created or none
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let mut created_ids = Vec::new();

    for request in &phrases {
        let accepted_json = serde_json::to_string(&request.accepted.clone().unwrap_or_default())
            .map_err(|e| format!("Failed to serialize accepted: {}", e))?;

        let target_lang = request
            .target_language
            .clone()
            .unwrap_or_else(|| "de".to_string());
        let native_lang = request
            .native_language
            .clone()
            .unwrap_or_else(|| "pl".to_string());

        tx.execute(
            "INSERT INTO phrases (conversation_id, prompt, answer, accepted_json, target_language, native_language, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                request.conversation_id,
                request.prompt,
                request.answer,
                accepted_json,
                target_lang,
                native_lang,
                request.notes
            ],
        )
        .map_err(|e| format!("Failed to create phrase: {}", e))?;

        created_ids.push(tx.last_insert_rowid());
    }

    // Fetch all created phrases before committing
    let mut created = Vec::new();
    for id in &created_ids {
        let phrase = tx
            .query_row(
                "SELECT id, conversation_id, prompt, answer, accepted_json, target_language, native_language, audio_path, notes, starred, created_at
                 FROM phrases WHERE id = ?1",
                params![id],
                row_to_phrase,
            )
            .map_err(|e| format!("Failed to retrieve created phrase: {}", e))?;
        created.push(phrase);
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(created)
}

#[tauri::command]
pub fn update_phrase(id: i64, request: UpdatePhraseRequest) -> Result<Phrase, String> {
    let conn = get_conn()?;

    if let Some(prompt) = &request.prompt {
        conn.execute(
            "UPDATE phrases SET prompt = ?1 WHERE id = ?2",
            params![prompt, id],
        )
        .map_err(|e| format!("Failed to update prompt: {}", e))?;
    }

    if let Some(answer) = &request.answer {
        conn.execute(
            "UPDATE phrases SET answer = ?1 WHERE id = ?2",
            params![answer, id],
        )
        .map_err(|e| format!("Failed to update answer: {}", e))?;
    }

    if let Some(accepted) = &request.accepted {
        let accepted_json =
            serde_json::to_string(accepted).map_err(|e| format!("Failed to serialize accepted: {}", e))?;
        conn.execute(
            "UPDATE phrases SET accepted_json = ?1 WHERE id = ?2",
            params![accepted_json, id],
        )
        .map_err(|e| format!("Failed to update accepted: {}", e))?;
    }

    if let Some(notes) = &request.notes {
        conn.execute(
            "UPDATE phrases SET notes = ?1 WHERE id = ?2",
            params![notes, id],
        )
        .map_err(|e| format!("Failed to update notes: {}", e))?;
    }

    if let Some(starred) = request.starred {
        conn.execute(
            "UPDATE phrases SET starred = ?1 WHERE id = ?2",
            params![starred as i32, id],
        )
        .map_err(|e| format!("Failed to update starred: {}", e))?;
    }

    conn.query_row(
        "SELECT id, conversation_id, prompt, answer, accepted_json, target_language, native_language, audio_path, notes, starred, created_at
         FROM phrases WHERE id = ?1",
        params![id],
        row_to_phrase,
    )
    .map_err(|e| format!("Phrase not found: {}", e))
}

#[tauri::command]
pub fn toggle_starred(id: i64) -> Result<bool, String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE phrases SET starred = NOT starred WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("Failed to toggle starred: {}", e))?;

    let starred: i32 = conn
        .query_row("SELECT starred FROM phrases WHERE id = ?1", params![id], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Failed to get starred status: {}", e))?;

    Ok(starred != 0)
}

#[tauri::command]
pub fn update_phrase_audio(id: i64, audio_path: String) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE phrases SET audio_path = ?1 WHERE id = ?2",
        params![audio_path, id],
    )
    .map_err(|e| format!("Failed to update audio path: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_phrase(id: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute("DELETE FROM phrases WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete phrase: {}", e))?;

    Ok(())
}
