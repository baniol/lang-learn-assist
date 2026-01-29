use crate::db::get_db_path;
use crate::models::{
    CreatePhraseRequest, Phrase, PhraseProgress, PhraseWithProgress, UpdatePhraseRequest,
};
use rusqlite::{params, Connection};

fn get_conn() -> Result<Connection, String> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;
    Ok(conn)
}

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

#[tauri::command]
pub fn get_phrases(
    conversationId: Option<i64>,
    starredOnly: Option<bool>,
    targetLanguage: Option<String>,
) -> Result<Vec<PhraseWithProgress>, String> {
    let conn = get_conn()?;

    let mut query = String::from(
        "SELECT p.id, p.conversation_id, p.prompt, p.answer, p.accepted_json,
                p.target_language, p.native_language, p.audio_path, p.notes, p.starred, p.created_at,
                pp.id as progress_id, pp.correct_streak, pp.total_attempts, pp.success_count, pp.last_seen
         FROM phrases p
         LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
         WHERE 1=1",
    );

    let mut conditions = Vec::new();

    if let Some(cid) = conversationId {
        conditions.push(format!("p.conversation_id = {}", cid));
    }

    if starredOnly.unwrap_or(false) {
        conditions.push("p.starred = 1".to_string());
    }

    if let Some(lang) = targetLanguage {
        conditions.push(format!("p.target_language = '{}'", lang));
    }

    for condition in conditions {
        query.push_str(" AND ");
        query.push_str(&condition);
    }

    query.push_str(" ORDER BY p.created_at DESC");

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let phrases = stmt
        .query_map([], |row| {
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
    let conn = get_conn()?;

    let mut created = Vec::new();

    for request in phrases {
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

        let phrase = conn
            .query_row(
                "SELECT id, conversation_id, prompt, answer, accepted_json, target_language, native_language, audio_path, notes, starred, created_at
                 FROM phrases WHERE id = ?1",
                params![id],
                row_to_phrase,
            )
            .map_err(|e| format!("Failed to retrieve created phrase: {}", e))?;

        created.push(phrase);
    }

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
    println!("delete_phrase called with id: {}", id);
    let conn = get_conn()?;

    let rows_affected = conn.execute("DELETE FROM phrases WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete phrase: {}", e))?;

    println!("delete_phrase: {} rows affected", rows_affected);

    Ok(())
}
