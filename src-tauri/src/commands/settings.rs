use crate::db::get_db_path;
use crate::models::{AppSettings, LanguageVoiceSettings};
use crate::state::AppState;
use rusqlite::Connection;
use std::collections::HashMap;
use tauri::State;

fn load_settings_from_db(conn: &Connection) -> AppSettings {
    let mut settings = AppSettings::with_defaults();

    let mut stmt = match conn.prepare("SELECT key, value FROM settings") {
        Ok(s) => s,
        Err(_) => return settings,
    };

    let rows = match stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }) {
        Ok(r) => r,
        Err(_) => return settings,
    };

    for row in rows.flatten() {
        let (key, value) = row;
        match key.as_str() {
            "llm_provider" => settings.llm_provider = value,
            "llm_api_key" => settings.llm_api_key = value,
            "llm_model" => settings.llm_model = value,
            "active_whisper_model" => settings.active_whisper_model = value,
            "tts_provider" => settings.tts_provider = value,
            "tts_api_key" => settings.tts_api_key = value,
            "tts_voice_id" => settings.tts_voice_id = value,
            "tts_voice_id_a" => settings.tts_voice_id_a = value,
            "tts_voice_id_b" => settings.tts_voice_id_b = value,
            "tts_voices_per_language" => {
                if let Ok(parsed) = serde_json::from_str::<HashMap<String, LanguageVoiceSettings>>(&value) {
                    settings.tts_voices_per_language = parsed;
                }
            }
            "target_language" => settings.target_language = value,
            "native_language" => settings.native_language = value,
            "required_streak" => {
                settings.required_streak = value.parse().unwrap_or(2);
            }
            "immediate_retry" => {
                settings.immediate_retry = value == "true";
            }
            "default_exercise_mode" => settings.default_exercise_mode = value,
            "failure_repetitions" => {
                settings.failure_repetitions = value.parse().unwrap_or(2);
            }
            "session_phrase_limit" => {
                settings.session_phrase_limit = value.parse().unwrap_or(20);
            }
            _ => {}
        }
    }

    // Migration: if tts_voices_per_language is empty but legacy voices exist,
    // populate the current target_language entry with legacy values
    if settings.tts_voices_per_language.is_empty() {
        let has_legacy = !settings.tts_voice_id.is_empty()
            || !settings.tts_voice_id_a.is_empty()
            || !settings.tts_voice_id_b.is_empty();
        if has_legacy && !settings.target_language.is_empty() {
            settings.tts_voices_per_language.insert(
                settings.target_language.clone(),
                LanguageVoiceSettings {
                    default: settings.tts_voice_id.clone(),
                    voice_a: settings.tts_voice_id_a.clone(),
                    voice_b: settings.tts_voice_id_b.clone(),
                },
            );
        }
    }

    settings
}

fn save_settings_to_db(conn: &Connection, settings: &AppSettings) -> Result<(), String> {
    // Serialize per-language voice settings to JSON
    let voices_json = serde_json::to_string(&settings.tts_voices_per_language)
        .map_err(|e| format!("Failed to serialize voice settings: {}", e))?;

    let pairs = [
        ("llm_provider", settings.llm_provider.clone()),
        ("llm_api_key", settings.llm_api_key.clone()),
        ("llm_model", settings.llm_model.clone()),
        ("active_whisper_model", settings.active_whisper_model.clone()),
        ("tts_provider", settings.tts_provider.clone()),
        ("tts_api_key", settings.tts_api_key.clone()),
        ("tts_voice_id", settings.tts_voice_id.clone()),
        ("tts_voice_id_a", settings.tts_voice_id_a.clone()),
        ("tts_voice_id_b", settings.tts_voice_id_b.clone()),
        ("tts_voices_per_language", voices_json),
        ("target_language", settings.target_language.clone()),
        ("native_language", settings.native_language.clone()),
        ("required_streak", settings.required_streak.to_string()),
        ("immediate_retry", settings.immediate_retry.to_string()),
        (
            "default_exercise_mode",
            settings.default_exercise_mode.clone(),
        ),
        (
            "failure_repetitions",
            settings.failure_repetitions.to_string(),
        ),
        (
            "session_phrase_limit",
            settings.session_phrase_limit.to_string(),
        ),
    ];

    for (key, value) in pairs {
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, value],
        )
        .map_err(|e| format!("Failed to save setting {}: {}", key, e))?;
    }

    Ok(())
}

pub fn load_initial_settings() -> AppSettings {
    let db_path = get_db_path();
    match Connection::open(&db_path) {
        Ok(conn) => load_settings_from_db(&conn),
        Err(_) => AppSettings::with_defaults(),
    }
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = state
        .settings
        .lock()
        .map_err(|e| format!("Failed to lock settings: {}", e))?;
    Ok(settings.clone())
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, settings: AppSettings) -> Result<(), String> {
    let db_path = get_db_path();
    let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    save_settings_to_db(&conn, &settings)?;

    let mut current = state
        .settings
        .lock()
        .map_err(|e| format!("Failed to lock settings: {}", e))?;
    *current = settings;

    Ok(())
}
