use crate::db::get_db_path;
use crate::models::{ChatMessage, Conversation, CreateConversationRequest};
use rusqlite::{params, Connection};

fn get_conn() -> Result<Connection, String> {
    let db_path = get_db_path();
    Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))
}

#[tauri::command]
pub fn get_conversations() -> Result<Vec<Conversation>, String> {
    let conn = get_conn()?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, subject, target_language, native_language, status,
                    raw_messages_json, final_messages_json, llm_summary, created_at, updated_at
             FROM conversations
             ORDER BY updated_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let conversations = stmt
        .query_map([], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                subject: row.get(2)?,
                target_language: row.get(3)?,
                native_language: row.get(4)?,
                status: row.get(5)?,
                raw_messages_json: row.get(6)?,
                final_messages_json: row.get(7)?,
                llm_summary: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("Failed to query conversations: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect conversations: {}", e))?;

    Ok(conversations)
}

#[tauri::command]
pub fn get_conversation(id: i64) -> Result<Conversation, String> {
    let conn = get_conn()?;

    conn.query_row(
        "SELECT id, title, subject, target_language, native_language, status,
                raw_messages_json, final_messages_json, llm_summary, created_at, updated_at
         FROM conversations WHERE id = ?1",
        params![id],
        |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                subject: row.get(2)?,
                target_language: row.get(3)?,
                native_language: row.get(4)?,
                status: row.get(5)?,
                raw_messages_json: row.get(6)?,
                final_messages_json: row.get(7)?,
                llm_summary: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| format!("Conversation not found: {}", e))
}

#[tauri::command]
pub fn create_conversation(request: CreateConversationRequest) -> Result<Conversation, String> {
    let conn = get_conn()?;

    let target_lang = request.target_language.unwrap_or_else(|| "de".to_string());
    let native_lang = request.native_language.unwrap_or_else(|| "pl".to_string());

    conn.execute(
        "INSERT INTO conversations (title, subject, target_language, native_language, raw_messages_json)
         VALUES (?1, ?2, ?3, ?4, '[]')",
        params![request.title, request.subject, target_lang, native_lang],
    )
    .map_err(|e| format!("Failed to create conversation: {}", e))?;

    let id = conn.last_insert_rowid();
    get_conversation(id)
}

#[tauri::command]
pub fn update_conversation_messages(id: i64, messages: Vec<ChatMessage>) -> Result<(), String> {
    let conn = get_conn()?;

    let messages_json =
        serde_json::to_string(&messages).map_err(|e| format!("Failed to serialize messages: {}", e))?;

    conn.execute(
        "UPDATE conversations SET raw_messages_json = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![messages_json, id],
    )
    .map_err(|e| format!("Failed to update conversation: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn update_conversation_title(id: i64, title: String) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE conversations SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![title, id],
    )
    .map_err(|e| format!("Failed to update conversation title: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn finalize_conversation(
    id: i64,
    final_messages: Vec<ChatMessage>,
    summary: Option<String>,
) -> Result<(), String> {
    let conn = get_conn()?;

    let messages_json = serde_json::to_string(&final_messages)
        .map_err(|e| format!("Failed to serialize messages: {}", e))?;

    conn.execute(
        "UPDATE conversations SET
            status = 'finalized',
            final_messages_json = ?1,
            llm_summary = ?2,
            updated_at = datetime('now')
         WHERE id = ?3",
        params![messages_json, summary, id],
    )
    .map_err(|e| format!("Failed to finalize conversation: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn archive_conversation(id: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE conversations SET status = 'archived', updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("Failed to archive conversation: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_conversation(id: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete conversation: {}", e))?;

    Ok(())
}
