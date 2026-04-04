use crate::db::get_conn;
use crate::models::Tag;
use crate::utils::db::row_to_tag;
use rusqlite::params;

#[tauri::command]
pub fn get_tags() -> Result<Vec<Tag>, String> {
    let conn = get_conn()?;

    let mut stmt = conn
        .prepare("SELECT id, name, created_at FROM tags ORDER BY name ASC")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let tags = stmt
        .query_map([], row_to_tag)
        .map_err(|e| format!("Failed to query tags: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect tags: {}", e))?;

    Ok(tags)
}

#[tauri::command]
pub fn create_tag(name: String) -> Result<Tag, String> {
    let conn = get_conn()?;

    conn.execute("INSERT INTO tags (name) VALUES (?1)", params![name.trim()])
        .map_err(|e| format!("Failed to create tag: {}", e))?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, name, created_at FROM tags WHERE id = ?1",
        params![id],
        row_to_tag,
    )
    .map_err(|e| format!("Failed to retrieve created tag: {}", e))
}

#[tauri::command]
pub fn delete_tag(id: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete tag: {}", e))?;

    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn add_tag_to_phrase(phraseId: i64, tagId: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute(
        "INSERT OR IGNORE INTO phrase_tags (phrase_id, tag_id) VALUES (?1, ?2)",
        params![phraseId, tagId],
    )
    .map_err(|e| format!("Failed to add tag to phrase: {}", e))?;

    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn remove_tag_from_phrase(phraseId: i64, tagId: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute(
        "DELETE FROM phrase_tags WHERE phrase_id = ?1 AND tag_id = ?2",
        params![phraseId, tagId],
    )
    .map_err(|e| format!("Failed to remove tag from phrase: {}", e))?;

    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn get_phrase_tags(phraseId: i64) -> Result<Vec<Tag>, String> {
    let conn = get_conn()?;

    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.created_at
             FROM tags t
             INNER JOIN phrase_tags pt ON pt.tag_id = t.id
             WHERE pt.phrase_id = ?1
             ORDER BY t.name ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let tags = stmt
        .query_map(params![phraseId], row_to_tag)
        .map_err(|e| format!("Failed to query phrase tags: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect phrase tags: {}", e))?;

    Ok(tags)
}
