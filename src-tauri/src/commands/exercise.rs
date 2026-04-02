use crate::db::get_conn;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExerciseSession {
    pub id: i64,
    pub date: String,
    pub phrases_completed: i64,
    pub phrases_total: i64,
    pub target_language: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckAnswerResult {
    pub correct: bool,
    pub expected_answer: String,
    pub matched_alternative: Option<String>,
    pub similarity: f64,
}

/// Normalize an answer string for comparison: trim, lowercase, strip trailing punctuation.
fn normalize(s: &str) -> String {
    let trimmed = s.trim().to_lowercase();
    trimmed
        .trim_end_matches(['.', '!', '?', ','])
        .trim()
        .to_string()
}

/// Compute Levenshtein distance between two strings.
fn levenshtein(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let a_len = a_chars.len();
    let b_len = b_chars.len();

    if a_len == 0 {
        return b_len;
    }
    if b_len == 0 {
        return a_len;
    }

    let mut prev: Vec<usize> = (0..=b_len).collect();
    let mut curr = vec![0; b_len + 1];

    for i in 1..=a_len {
        curr[0] = i;
        for j in 1..=b_len {
            let cost = if a_chars[i - 1] == b_chars[j - 1] {
                0
            } else {
                1
            };
            curr[j] = (prev[j] + 1).min(curr[j - 1] + 1).min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }

    prev[b_len]
}

/// Compute similarity ratio (0.0 = completely different, 1.0 = identical).
fn similarity(a: &str, b: &str) -> f64 {
    let max_len = a.len().max(b.len());
    if max_len == 0 {
        return 1.0;
    }
    let dist = levenshtein(a, b);
    1.0 - (dist as f64 / max_len as f64)
}

const FUZZY_THRESHOLD: f64 = 0.85;

#[tauri::command]
#[allow(non_snake_case)]
pub fn check_exercise_answer(
    userAnswer: String,
    expectedAnswer: String,
    accepted: Vec<String>,
    fuzzy: bool,
) -> Result<CheckAnswerResult, String> {
    let normalized_user = normalize(&userAnswer);
    let normalized_expected = normalize(&expectedAnswer);

    // Exact match against expected answer
    if normalized_user == normalized_expected {
        return Ok(CheckAnswerResult {
            correct: true,
            expected_answer: expectedAnswer,
            matched_alternative: None,
            similarity: 1.0,
        });
    }

    // Exact match against accepted alternatives
    for alt in &accepted {
        if normalized_user == normalize(alt) {
            return Ok(CheckAnswerResult {
                correct: true,
                expected_answer: expectedAnswer,
                matched_alternative: Some(alt.clone()),
                similarity: 1.0,
            });
        }
    }

    // Fuzzy matching
    if fuzzy {
        let sim = similarity(&normalized_user, &normalized_expected);
        if sim >= FUZZY_THRESHOLD {
            return Ok(CheckAnswerResult {
                correct: true,
                expected_answer: expectedAnswer,
                matched_alternative: None,
                similarity: sim,
            });
        }

        // Also check accepted alternatives with fuzzy
        for alt in &accepted {
            let alt_sim = similarity(&normalized_user, &normalize(alt));
            if alt_sim >= FUZZY_THRESHOLD {
                return Ok(CheckAnswerResult {
                    correct: true,
                    expected_answer: expectedAnswer,
                    matched_alternative: Some(alt.clone()),
                    similarity: alt_sim,
                });
            }
        }

        // Return best similarity for feedback
        let best_sim = std::iter::once(sim)
            .chain(
                accepted
                    .iter()
                    .map(|alt| similarity(&normalized_user, &normalize(alt))),
            )
            .fold(0.0_f64, f64::max);

        return Ok(CheckAnswerResult {
            correct: false,
            expected_answer: expectedAnswer,
            matched_alternative: None,
            similarity: best_sim,
        });
    }

    // No match, compute similarity for feedback
    let sim = similarity(&normalized_user, &normalized_expected);

    Ok(CheckAnswerResult {
        correct: false,
        expected_answer: expectedAnswer,
        matched_alternative: None,
        similarity: sim,
    })
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn save_exercise_session(
    date: String,
    phrasesCompleted: i64,
    phrasesTotal: i64,
    targetLanguage: String,
) -> Result<(), String> {
    let conn = get_conn()?;
    conn.execute(
        "INSERT INTO exercise_sessions (date, phrases_completed, phrases_total, target_language) VALUES (?1, ?2, ?3, ?4)",
        params![date, phrasesCompleted, phrasesTotal, targetLanguage],
    )
    .map_err(|e| format!("Failed to save exercise session: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_exercise_calendar() -> Result<Vec<String>, String> {
    let conn = get_conn()?;
    let mut stmt = conn
        .prepare("SELECT DISTINCT date FROM exercise_sessions ORDER BY date ASC")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;
    let dates = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect dates: {}", e))?;
    Ok(dates)
}

#[tauri::command]
pub fn get_exercise_day_details(date: String) -> Result<Vec<ExerciseSession>, String> {
    let conn = get_conn()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, date, phrases_completed, phrases_total, target_language, created_at
             FROM exercise_sessions WHERE date = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;
    let sessions = stmt
        .query_map(params![date], |row| {
            Ok(ExerciseSession {
                id: row.get(0)?,
                date: row.get(1)?,
                phrases_completed: row.get(2)?,
                phrases_total: row.get(3)?,
                target_language: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect sessions: {}", e))?;
    Ok(sessions)
}

#[tauri::command]
pub fn get_all_exercise_sessions() -> Result<Vec<ExerciseSession>, String> {
    let conn = get_conn()?;
    let mut stmt = conn
        .prepare(
            "SELECT id, date, phrases_completed, phrases_total, target_language, created_at
             FROM exercise_sessions ORDER BY date DESC, created_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;
    let sessions = stmt
        .query_map([], |row| {
            Ok(ExerciseSession {
                id: row.get(0)?,
                date: row.get(1)?,
                phrases_completed: row.get(2)?,
                phrases_total: row.get(3)?,
                target_language: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect sessions: {}", e))?;
    Ok(sessions)
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn delete_exercise_session(sessionId: i64) -> Result<(), String> {
    let conn = get_conn()?;
    let affected = conn
        .execute(
            "DELETE FROM exercise_sessions WHERE id = ?1",
            params![sessionId],
        )
        .map_err(|e| format!("Failed to delete exercise session: {}", e))?;
    if affected == 0 {
        return Err(format!("Session {} not found", sessionId));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_match() {
        let result = check_exercise_answer(
            "Guten Morgen".to_string(),
            "Guten Morgen".to_string(),
            vec![],
            false,
        )
        .unwrap();
        assert!(result.correct);
        assert_eq!(result.similarity, 1.0);
    }

    #[test]
    fn test_case_insensitive() {
        let result = check_exercise_answer(
            "guten morgen".to_string(),
            "Guten Morgen".to_string(),
            vec![],
            false,
        )
        .unwrap();
        assert!(result.correct);
    }

    #[test]
    fn test_trailing_punctuation_stripped() {
        let result = check_exercise_answer(
            "Guten Morgen!".to_string(),
            "Guten Morgen".to_string(),
            vec![],
            false,
        )
        .unwrap();
        assert!(result.correct);
    }

    #[test]
    fn test_accepted_alternative() {
        let result = check_exercise_answer(
            "Morgen!".to_string(),
            "Guten Morgen".to_string(),
            vec!["Morgen".to_string()],
            false,
        )
        .unwrap();
        assert!(result.correct);
        assert_eq!(result.matched_alternative, Some("Morgen".to_string()));
    }

    #[test]
    fn test_incorrect_no_fuzzy() {
        let result = check_exercise_answer(
            "Guten Abend".to_string(),
            "Guten Morgen".to_string(),
            vec![],
            false,
        )
        .unwrap();
        assert!(!result.correct);
    }

    #[test]
    fn test_fuzzy_close_match() {
        let result = check_exercise_answer(
            "Guten Morge".to_string(),
            "Guten Morgen".to_string(),
            vec![],
            true,
        )
        .unwrap();
        assert!(result.correct);
        assert!(result.similarity >= FUZZY_THRESHOLD);
    }

    #[test]
    fn test_fuzzy_too_different() {
        let result = check_exercise_answer(
            "Hallo".to_string(),
            "Guten Morgen".to_string(),
            vec![],
            true,
        )
        .unwrap();
        assert!(!result.correct);
    }

    #[test]
    fn test_normalize_whitespace() {
        let result = check_exercise_answer(
            "  Guten Morgen  ".to_string(),
            "Guten Morgen".to_string(),
            vec![],
            false,
        )
        .unwrap();
        assert!(result.correct);
    }
}
