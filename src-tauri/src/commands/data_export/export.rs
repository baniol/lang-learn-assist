use crate::db::get_conn;
use crate::models::{
    ExportData, ExportMaterial, ExportMaterialThread, ExportPhrase, ExportPhraseThread,
    ExportSetting,
};
use rusqlite::Connection;

#[tauri::command]
pub fn export_data() -> Result<ExportData, String> {
    let conn = get_conn()?;
    export_data_with_conn(&conn)
}

/// Core export logic that can be tested with any connection
pub fn export_data_with_conn(conn: &Connection) -> Result<ExportData, String> {
    // Export settings
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| format!("Failed to prepare settings query: {}", e))?;
    let settings = stmt
        .query_map([], |row| {
            Ok(ExportSetting {
                key: row.get(0)?,
                value: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query settings: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect settings: {}", e))?;
    drop(stmt);

    // Export phrases
    let mut stmt = conn
        .prepare(
            "SELECT id, prompt, answer, accepted_json, target_language,
                    native_language, audio_path, notes, starred, created_at, material_id
             FROM phrases",
        )
        .map_err(|e| format!("Failed to prepare phrases query: {}", e))?;
    let phrases = stmt
        .query_map([], |row| {
            let starred_int: i32 = row.get(8)?;
            Ok(ExportPhrase {
                id: row.get(0)?,
                conversation_id: None,
                material_id: row.get(10).ok(),
                deck_id: None,
                prompt: row.get(1)?,
                answer: row.get(2)?,
                accepted_json: row.get(3)?,
                target_language: row.get(4)?,
                native_language: row.get(5)?,
                audio_path: row.get(6)?,
                notes: row.get(7)?,
                starred: starred_int != 0,
                excluded: None,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("Failed to query phrases: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect phrases: {}", e))?;
    drop(stmt);

    // Export phrase threads
    let mut stmt = conn
        .prepare(
            "SELECT id, phrase_id, messages_json, suggested_prompt, suggested_answer,
                    suggested_accepted, status, created_at, updated_at
             FROM phrase_threads",
        )
        .map_err(|e| format!("Failed to prepare phrase_threads query: {}", e))?;
    let phrase_threads = stmt
        .query_map([], |row| {
            Ok(ExportPhraseThread {
                id: row.get(0)?,
                phrase_id: row.get(1)?,
                messages_json: row.get(2)?,
                suggested_prompt: row.get(3)?,
                suggested_answer: row.get(4)?,
                suggested_accepted: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query phrase_threads: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect phrase_threads: {}", e))?;
    drop(stmt);

    // Export materials
    let mut stmt = conn
        .prepare(
            "SELECT id, title, material_type, source_url, original_text, segments_json,
                    target_language, native_language, status, created_at, updated_at
             FROM materials",
        )
        .map_err(|e| format!("Failed to prepare materials query: {}", e))?;
    let materials = stmt
        .query_map([], |row| {
            Ok(ExportMaterial {
                id: row.get(0)?,
                title: row.get(1)?,
                material_type: row.get(2)?,
                source_url: row.get(3)?,
                original_text: row.get(4)?,
                segments_json: row.get(5)?,
                target_language: row.get(6)?,
                native_language: row.get(7)?,
                status: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("Failed to query materials: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect materials: {}", e))?;
    drop(stmt);

    // Export material threads
    let mut stmt = conn
        .prepare(
            "SELECT id, material_id, segment_index, messages_json, suggested_phrases_json,
                    created_at, updated_at
             FROM material_threads",
        )
        .map_err(|e| format!("Failed to prepare material_threads query: {}", e))?;
    let material_threads = stmt
        .query_map([], |row| {
            Ok(ExportMaterialThread {
                id: row.get(0)?,
                material_id: row.get(1)?,
                segment_index: row.get(2)?,
                messages_json: row.get(3)?,
                suggested_phrases_json: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to query material_threads: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect material_threads: {}", e))?;
    drop(stmt);

    Ok(ExportData {
        version: 4,
        exported_at: chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        settings,
        phrases,
        phrase_threads,
        question_threads: vec![],
        notes: vec![],
        materials,
        material_threads,
        phrase_progress: vec![],
        practice_sessions: vec![],
        decks: vec![],
    })
}
