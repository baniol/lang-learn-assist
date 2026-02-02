use crate::db::get_conn;
use crate::models::{CreateNoteRequest, Note, UpdateNoteRequest};
use rusqlite::params;

fn row_to_note(row: &rusqlite::Row) -> Result<Note, rusqlite::Error> {
    Ok(Note {
        id: row.get(0)?,
        content: row.get(1)?,
        created_at: row.get(2)?,
        updated_at: row.get(3)?,
    })
}

#[tauri::command]
pub fn get_notes() -> Result<Vec<Note>, String> {
    let conn = get_conn()?;

    let mut stmt = conn
        .prepare(
            "SELECT id, content, created_at, updated_at
             FROM notes
             ORDER BY updated_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let notes = stmt
        .query_map([], row_to_note)
        .map_err(|e| format!("Failed to query notes: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect notes: {}", e))?;

    Ok(notes)
}

#[tauri::command]
pub fn get_note(id: i64) -> Result<Note, String> {
    let conn = get_conn()?;

    conn.query_row(
        "SELECT id, content, created_at, updated_at FROM notes WHERE id = ?1",
        params![id],
        row_to_note,
    )
    .map_err(|e| format!("Note not found: {}", e))
}

#[tauri::command]
pub fn create_note(request: CreateNoteRequest) -> Result<Note, String> {
    let conn = get_conn()?;

    conn.execute(
        "INSERT INTO notes (content, created_at, updated_at)
         VALUES (?1, datetime('now'), datetime('now'))",
        params![request.content],
    )
    .map_err(|e| format!("Failed to create note: {}", e))?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, content, created_at, updated_at FROM notes WHERE id = ?1",
        params![id],
        row_to_note,
    )
    .map_err(|e| format!("Failed to retrieve created note: {}", e))
}

#[tauri::command]
pub fn update_note(id: i64, request: UpdateNoteRequest) -> Result<Note, String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE notes SET content = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![request.content, id],
    )
    .map_err(|e| format!("Failed to update note: {}", e))?;

    conn.query_row(
        "SELECT id, content, created_at, updated_at FROM notes WHERE id = ?1",
        params![id],
        row_to_note,
    )
    .map_err(|e| format!("Note not found: {}", e))
}

#[tauri::command]
pub fn delete_note(id: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete note: {}", e))?;

    Ok(())
}
