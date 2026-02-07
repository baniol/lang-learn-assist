use crate::db::get_conn;
use crate::models::{
    CreatePhraseRequest, Phrase, PhraseThread, PhraseThreadMessage,
    PhraseWithProgress, UpdatePhraseRequest,
};
use crate::state::AppState;
use crate::utils::db::{row_to_phrase, row_to_phrase_with_progress};
use crate::utils::lock::SafeRwLock;
use rusqlite::params;
use tauri::State;

/// Status filter for phrase queries
/// - "all": no filtering
/// - "new": phrases with no progress
/// - "learning": phrases with progress but streak < 2
/// - "learned": phrases with streak >= 2
/// - "excluded": only excluded phrases
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_phrases(
    conversationId: Option<i64>,
    starredOnly: Option<bool>,
    excludedOnly: Option<bool>,
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

    if let Some(excluded) = excludedOnly {
        if excluded {
            conditions.push("p.excluded = 1");
        } else {
            conditions.push("p.excluded = 0");
        }
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
                p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.excluded, p.created_at, p.material_id, p.deck_id, p.refined,
                pp.id as progress_id, pp.correct_streak, pp.total_attempts, pp.success_count, pp.last_seen,
                pp.ease_factor, pp.interval_days, pp.next_review_at, pp.in_srs_pool, pp.deck_correct_count
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
        .query_map(params.as_slice(), row_to_phrase_with_progress)
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
                p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.excluded, p.created_at, p.material_id, p.deck_id, p.refined,
                pp.id as progress_id, pp.correct_streak, pp.total_attempts, pp.success_count, pp.last_seen,
                pp.ease_factor, pp.interval_days, pp.next_review_at, pp.in_srs_pool, pp.deck_correct_count
         FROM phrases p
         LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
         WHERE p.id = ?1",
        params![id],
        row_to_phrase_with_progress,
    )
    .map_err(|e| format!("Phrase not found: {}", e))
}

#[tauri::command]
pub fn create_phrase(
    state: State<'_, AppState>,
    request: CreatePhraseRequest,
) -> Result<Phrase, String> {
    let conn = get_conn()?;

    let accepted_json = serde_json::to_string(&request.accepted.unwrap_or_default())
        .map_err(|e| format!("Failed to serialize accepted: {}", e))?;

    // Get default languages from settings if not provided in request
    let settings = state.settings.safe_read()?;

    let target_lang = request
        .target_language
        .unwrap_or_else(|| settings.target_language.clone());
    let native_lang = request
        .native_language
        .unwrap_or_else(|| settings.native_language.clone());

    conn.execute(
        "INSERT INTO phrases (conversation_id, material_id, prompt, answer, accepted_json, target_language, native_language, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            request.conversation_id,
            request.material_id,
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
        "SELECT id, conversation_id, prompt, answer, accepted_json, target_language, native_language, audio_path, notes, starred, excluded, created_at, material_id, deck_id
         FROM phrases WHERE id = ?1",
        params![id],
        row_to_phrase,
    )
    .map_err(|e| format!("Failed to retrieve created phrase: {}", e))
}

#[tauri::command]
pub fn create_phrases_batch(
    state: State<'_, AppState>,
    phrases: Vec<CreatePhraseRequest>,
) -> Result<Vec<Phrase>, String> {
    let mut conn = get_conn()?;

    // Get default languages from settings
    let (default_target_lang, default_native_lang) = {
        let settings = state.settings.safe_read()?;
        (settings.target_language.clone(), settings.native_language.clone())
    };

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
            .unwrap_or_else(|| default_target_lang.clone());
        let native_lang = request
            .native_language
            .clone()
            .unwrap_or_else(|| default_native_lang.clone());

        tx.execute(
            "INSERT INTO phrases (conversation_id, material_id, prompt, answer, accepted_json, target_language, native_language, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                request.conversation_id,
                request.material_id,
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
                "SELECT id, conversation_id, prompt, answer, accepted_json, target_language, native_language, audio_path, notes, starred, excluded, created_at, material_id, deck_id
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

    if let Some(refined) = request.refined {
        conn.execute(
            "UPDATE phrases SET refined = ?1 WHERE id = ?2",
            params![refined as i32, id],
        )
        .map_err(|e| format!("Failed to update refined: {}", e))?;
    }

    conn.query_row(
        "SELECT id, conversation_id, prompt, answer, accepted_json, target_language, native_language, audio_path, notes, starred, excluded, created_at, material_id, deck_id, refined
         FROM phrases WHERE id = ?1",
        params![id],
        row_to_phrase,
    )
    .map_err(|e| format!("Phrase not found: {}", e))
}

#[tauri::command]
pub fn toggle_excluded(id: i64) -> Result<bool, String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE phrases SET excluded = NOT excluded WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("Failed to toggle excluded: {}", e))?;

    let excluded: i32 = conn
        .query_row("SELECT excluded FROM phrases WHERE id = ?1", params![id], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Failed to get excluded status: {}", e))?;

    Ok(excluded != 0)
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

fn row_to_phrase_thread(row: &rusqlite::Row) -> Result<PhraseThread, rusqlite::Error> {
    let messages_json: String = row.get(2)?;
    let messages: Vec<PhraseThreadMessage> = serde_json::from_str(&messages_json).unwrap_or_default();
    let suggested_accepted_json: Option<String> = row.get(5)?;
    let suggested_accepted: Option<Vec<String>> = suggested_accepted_json
        .and_then(|j| serde_json::from_str(&j).ok());

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

#[tauri::command]
#[allow(non_snake_case)]
pub fn get_phrase_thread(phraseId: i64) -> Result<Option<PhraseThread>, String> {
    let conn = get_conn()?;

    let result = conn.query_row(
        "SELECT id, phrase_id, messages_json, suggested_prompt, suggested_answer,
                suggested_accepted, status, created_at, updated_at
         FROM phrase_threads
         WHERE phrase_id = ?1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1",
        params![phraseId],
        row_to_phrase_thread,
    );

    match result {
        Ok(thread) => Ok(Some(thread)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get phrase thread: {}", e)),
    }
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn create_phrase_thread(phraseId: i64) -> Result<PhraseThread, String> {
    let conn = get_conn()?;

    conn.execute(
        "INSERT INTO phrase_threads (phrase_id, messages_json, status, created_at, updated_at)
         VALUES (?1, '[]', 'active', datetime('now'), datetime('now'))",
        params![phraseId],
    )
    .map_err(|e| format!("Failed to create phrase thread: {}", e))?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, phrase_id, messages_json, suggested_prompt, suggested_answer,
                suggested_accepted, status, created_at, updated_at
         FROM phrase_threads WHERE id = ?1",
        params![id],
        row_to_phrase_thread,
    )
    .map_err(|e| format!("Failed to retrieve created thread: {}", e))
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn update_phrase_thread(
    threadId: i64,
    messages: Vec<PhraseThreadMessage>,
    suggestedPrompt: Option<String>,
    suggestedAnswer: Option<String>,
    suggestedAccepted: Option<Vec<String>>,
) -> Result<PhraseThread, String> {
    let conn = get_conn()?;

    let messages_json = serde_json::to_string(&messages)
        .map_err(|e| format!("Failed to serialize messages: {}", e))?;
    let accepted_json = suggestedAccepted
        .map(|a| serde_json::to_string(&a).unwrap_or_else(|_| "[]".to_string()));

    conn.execute(
        "UPDATE phrase_threads
         SET messages_json = ?1, suggested_prompt = ?2, suggested_answer = ?3,
             suggested_accepted = ?4, updated_at = datetime('now')
         WHERE id = ?5",
        params![messages_json, suggestedPrompt, suggestedAnswer, accepted_json, threadId],
    )
    .map_err(|e| format!("Failed to update phrase thread: {}", e))?;

    conn.query_row(
        "SELECT id, phrase_id, messages_json, suggested_prompt, suggested_answer,
                suggested_accepted, status, created_at, updated_at
         FROM phrase_threads WHERE id = ?1",
        params![threadId],
        row_to_phrase_thread,
    )
    .map_err(|e| format!("Failed to retrieve updated thread: {}", e))
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn accept_phrase_thread(threadId: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE phrase_threads SET status = 'accepted', updated_at = datetime('now') WHERE id = ?1",
        params![threadId],
    )
    .map_err(|e| format!("Failed to accept phrase thread: {}", e))?;

    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn delete_phrase_thread(threadId: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute("DELETE FROM phrase_threads WHERE id = ?1", params![threadId])
        .map_err(|e| format!("Failed to delete phrase thread: {}", e))?;

    Ok(())
}
