use crate::db::get_conn;
use rusqlite::params;

/// Result of finding duplicate phrases
#[derive(Debug, Clone, serde::Serialize)]
pub struct DuplicateInfo {
    pub answer: String,
    pub target_language: String,
    /// IDs of phrases to remove (all except the earliest created)
    pub duplicate_ids: Vec<i64>,
    /// ID of the phrase to keep (earliest created_at)
    pub keep_id: i64,
}

/// Result of duplicate removal
#[derive(Debug, Clone, serde::Serialize)]
pub struct RemoveDuplicatesResult {
    pub duplicates_found: i32,
    pub phrases_removed: i32,
    pub details: Vec<DuplicateInfo>,
}

/// Find duplicate phrases based on answer + target_language without removing them.
#[tauri::command]
pub fn find_duplicate_phrases() -> Result<RemoveDuplicatesResult, String> {
    let conn = get_conn()?;

    let mut stmt = conn
        .prepare(
            "SELECT answer, target_language, COUNT(*) as cnt
             FROM phrases
             GROUP BY answer, target_language
             HAVING cnt > 1",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let duplicates: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query duplicates: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect: {}", e))?;

    let mut details = Vec::new();

    for (answer, target_language) in duplicates {
        let mut stmt = conn
            .prepare(
                "SELECT p.id
                 FROM phrases p
                 WHERE p.answer = ?1 AND p.target_language = ?2
                 ORDER BY p.created_at ASC",
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let ids: Vec<i64> = stmt
            .query_map(params![answer, target_language], |row| row.get(0))
            .map_err(|e| format!("Failed to query phrase ids: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect ids: {}", e))?;

        if ids.len() > 1 {
            details.push(DuplicateInfo {
                answer: answer.clone(),
                target_language: target_language.clone(),
                keep_id: ids[0],
                duplicate_ids: ids[1..].to_vec(),
            });
        }
    }

    Ok(RemoveDuplicatesResult {
        duplicates_found: details.len() as i32,
        phrases_removed: 0,
        details,
    })
}

/// Remove duplicate phrases, keeping the one with earliest creation date.
#[tauri::command]
pub fn remove_duplicate_phrases() -> Result<RemoveDuplicatesResult, String> {
    let mut conn = get_conn()?;

    let found = find_duplicate_phrases()?;

    if found.details.is_empty() {
        return Ok(RemoveDuplicatesResult {
            duplicates_found: 0,
            phrases_removed: 0,
            details: vec![],
        });
    }

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let mut total_removed = 0;

    for dup in &found.details {
        for id in &dup.duplicate_ids {
            tx.execute("DELETE FROM phrases WHERE id = ?1", params![id])
                .map_err(|e| format!("Failed to delete phrase: {}", e))?;
            total_removed += 1;
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit: {}", e))?;

    Ok(RemoveDuplicatesResult {
        duplicates_found: found.details.len() as i32,
        phrases_removed: total_removed,
        details: found.details,
    })
}
