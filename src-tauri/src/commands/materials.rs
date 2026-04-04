use crate::db::get_conn;
use crate::models::{
    CreateMaterialRequest, Material, MaterialThread, MaterialThreadMessage, SuggestedPhrase,
    TextSegment, UpdateMaterialRequest,
};
use crate::state::AppState;
use crate::utils::db::{row_to_material, row_to_material_thread, MATERIAL_COLUMNS};
use crate::utils::lock::SafeRwLock;
use crate::utils::regex::TIMESTAMP_REGEX;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn create_material(
    state: State<'_, AppState>,
    request: CreateMaterialRequest,
) -> Result<Material, String> {
    let conn = get_conn()?;

    // Get default languages from settings if not provided
    let settings = state.settings.safe_read()?;

    let target_lang = request
        .target_language
        .unwrap_or_else(|| settings.target_language.clone());
    let native_lang = request
        .native_language
        .unwrap_or_else(|| settings.native_language.clone());

    conn.execute(
        "INSERT INTO materials (title, material_type, source_url, original_text, target_language, native_language, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending')",
        params![
            request.title,
            request.material_type,
            request.source_url,
            request.original_text,
            target_lang,
            native_lang,
        ],
    )
    .map_err(|e| format!("Failed to create material: {}", e))?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        &format!("SELECT {MATERIAL_COLUMNS} FROM materials WHERE id = ?1"),
        params![id],
        row_to_material,
    )
    .map_err(|e| format!("Failed to retrieve created material: {}", e))
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn get_materials(
    targetLanguage: Option<String>,
    materialType: Option<String>,
) -> Result<Vec<Material>, String> {
    let conn = get_conn()?;

    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref lang) = targetLanguage {
        conditions.push("target_language = ?");
        param_values.push(Box::new(lang.clone()));
    }

    if let Some(ref mtype) = materialType {
        conditions.push("material_type = ?");
        param_values.push(Box::new(mtype.clone()));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };

    let query = format!(
        "SELECT {MATERIAL_COLUMNS} FROM materials{} ORDER BY created_at DESC",
        where_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let params: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let materials = stmt
        .query_map(params.as_slice(), row_to_material)
        .map_err(|e| format!("Failed to query materials: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect materials: {}", e))?;

    Ok(materials)
}

/// Parse timestamps from original transcript text
fn parse_timestamps_from_original(text: &str) -> Vec<String> {
    let mut timestamps = Vec::new();

    for line in text.lines() {
        let line = line.trim();
        if let Some(caps) = TIMESTAMP_REGEX.captures(line) {
            if let Some(ts) = caps.get(1) {
                timestamps.push(ts.as_str().to_string());
            }
        }
    }

    timestamps
}

/// Enrich segments with timestamps from original text if missing
fn enrich_segments_with_timestamps(
    segments_json: &str,
    original_text: &str,
    material_type: &str,
) -> String {
    if material_type != "transcript" {
        return segments_json.to_string();
    }

    let mut segments: Vec<TextSegment> = match serde_json::from_str(segments_json) {
        Ok(s) => s,
        Err(_) => return segments_json.to_string(),
    };

    // Check if any segment already has a timestamp
    if segments.iter().any(|s| s.timestamp.is_some()) {
        return segments_json.to_string();
    }

    // Parse timestamps from original
    let timestamps = parse_timestamps_from_original(original_text);

    // Assign timestamps to segments (best effort - distribute evenly if counts don't match)
    if !timestamps.is_empty() {
        let seg_len = segments.len();
        let ts_len = timestamps.len();
        for (i, segment) in segments.iter_mut().enumerate() {
            // Map segment index to timestamp index
            let ts_idx = if ts_len >= seg_len {
                // More timestamps than segments - use proportional mapping
                (i * ts_len) / seg_len
            } else {
                // Fewer timestamps - use modulo or just first ones
                i.min(ts_len - 1)
            };
            segment.timestamp = Some(timestamps[ts_idx].clone());
        }
    }

    serde_json::to_string(&segments).unwrap_or_else(|_| segments_json.to_string())
}

#[tauri::command]
pub fn get_material(id: i64) -> Result<Material, String> {
    let conn = get_conn()?;

    let mut material = conn
        .query_row(
            &format!("SELECT {MATERIAL_COLUMNS} FROM materials WHERE id = ?1"),
            params![id],
            row_to_material,
        )
        .map_err(|e| format!("Material not found: {}", e))?;

    // Enrich segments with timestamps if missing
    if let Some(ref segments_json) = material.segments_json {
        material.segments_json = Some(enrich_segments_with_timestamps(
            segments_json,
            &material.original_text,
            &material.material_type,
        ));
    }

    Ok(material)
}

#[tauri::command]
pub fn update_material(id: i64, request: UpdateMaterialRequest) -> Result<Material, String> {
    let conn = get_conn()?;

    if let Some(title) = &request.title {
        conn.execute(
            "UPDATE materials SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![title, id],
        )
        .map_err(|e| format!("Failed to update title: {}", e))?;
    }

    if let Some(segments_json) = &request.segments_json {
        conn.execute(
            "UPDATE materials SET segments_json = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![segments_json, id],
        )
        .map_err(|e| format!("Failed to update segments: {}", e))?;
    }

    if let Some(status) = &request.status {
        conn.execute(
            "UPDATE materials SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![status, id],
        )
        .map_err(|e| format!("Failed to update status: {}", e))?;
    }

    conn.query_row(
        &format!("SELECT {MATERIAL_COLUMNS} FROM materials WHERE id = ?1"),
        params![id],
        row_to_material,
    )
    .map_err(|e| format!("Material not found: {}", e))
}

#[tauri::command]
pub fn delete_material(id: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute("DELETE FROM materials WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete material: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_all_materials() -> Result<i64, String> {
    let conn = get_conn()?;

    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM materials", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count materials: {}", e))?;

    conn.execute("DELETE FROM material_threads", [])
        .map_err(|e| format!("Failed to delete material threads: {}", e))?;
    // SET NULL on phrases that reference materials
    conn.execute(
        "UPDATE phrases SET material_id = NULL WHERE material_id IS NOT NULL",
        [],
    )
    .map_err(|e| format!("Failed to clear phrase material references: {}", e))?;
    conn.execute("DELETE FROM materials", [])
        .map_err(|e| format!("Failed to delete materials: {}", e))?;

    Ok(count)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn update_material_bookmark(id: i64, bookmarkIndex: Option<i32>) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute(
        "UPDATE materials SET bookmark_index = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![bookmarkIndex, id],
    )
    .map_err(|e| format!("Failed to update bookmark: {}", e))?;

    Ok(())
}

// Material Threads

#[tauri::command]
#[allow(non_snake_case)]
pub fn get_material_thread(
    materialId: i64,
    segmentIndex: i32,
) -> Result<Option<MaterialThread>, String> {
    let conn = get_conn()?;

    let result = conn.query_row(
        "SELECT id, material_id, segment_index, messages_json, suggested_phrases_json, created_at, updated_at
         FROM material_threads
         WHERE material_id = ?1 AND segment_index = ?2
         ORDER BY created_at DESC
         LIMIT 1",
        params![materialId, segmentIndex],
        row_to_material_thread,
    );

    match result {
        Ok(thread) => Ok(Some(thread)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to get material thread: {}", e)),
    }
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn create_material_thread(
    materialId: i64,
    segmentIndex: i32,
) -> Result<MaterialThread, String> {
    let conn = get_conn()?;

    conn.execute(
        "INSERT INTO material_threads (material_id, segment_index, messages_json, created_at, updated_at)
         VALUES (?1, ?2, '[]', datetime('now'), datetime('now'))",
        params![materialId, segmentIndex],
    )
    .map_err(|e| format!("Failed to create material thread: {}", e))?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT id, material_id, segment_index, messages_json, suggested_phrases_json, created_at, updated_at
         FROM material_threads WHERE id = ?1",
        params![id],
        row_to_material_thread,
    )
    .map_err(|e| format!("Failed to retrieve created thread: {}", e))
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn update_material_thread(
    threadId: i64,
    messages: Vec<MaterialThreadMessage>,
    suggestedPhrases: Option<Vec<SuggestedPhrase>>,
) -> Result<MaterialThread, String> {
    let conn = get_conn()?;

    let messages_json = serde_json::to_string(&messages)
        .map_err(|e| format!("Failed to serialize messages: {}", e))?;
    let phrases_json =
        suggestedPhrases.map(|p| serde_json::to_string(&p).unwrap_or_else(|_| "[]".to_string()));

    conn.execute(
        "UPDATE material_threads
         SET messages_json = ?1, suggested_phrases_json = ?2, updated_at = datetime('now')
         WHERE id = ?3",
        params![messages_json, phrases_json, threadId],
    )
    .map_err(|e| format!("Failed to update material thread: {}", e))?;

    conn.query_row(
        "SELECT id, material_id, segment_index, messages_json, suggested_phrases_json, created_at, updated_at
         FROM material_threads WHERE id = ?1",
        params![threadId],
        row_to_material_thread,
    )
    .map_err(|e| format!("Failed to retrieve updated thread: {}", e))
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn delete_material_thread(threadId: i64) -> Result<(), String> {
    let conn = get_conn()?;

    conn.execute(
        "DELETE FROM material_threads WHERE id = ?1",
        params![threadId],
    )
    .map_err(|e| format!("Failed to delete material thread: {}", e))?;

    Ok(())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn get_material_thread_indices(materialId: i64) -> Result<Vec<(i32, String)>, String> {
    let conn = get_conn()?;

    let mut stmt = conn
        .prepare("SELECT segment_index, created_at FROM material_threads WHERE material_id = ?1")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let indices = stmt
        .query_map(params![materialId], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query thread indices: {}", e))?
        .collect::<Result<Vec<(i32, String)>, _>>()
        .map_err(|e| format!("Failed to collect indices: {}", e))?;

    Ok(indices)
}
