use crate::db::get_audio_dir;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::time::Duration;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsVoice {
    pub voice_id: String,
    pub name: String,
    pub language: String,
    pub provider: String,
}

#[derive(Deserialize)]
struct ElevenLabsVoice {
    voice_id: String,
    name: String,
}

#[derive(Deserialize)]
struct ElevenLabsVoicesResponse {
    voices: Vec<ElevenLabsVoice>,
}

#[tauri::command]
pub async fn get_available_voices(state: State<'_, AppState>) -> Result<Vec<TtsVoice>, String> {
    let settings = {
        let guard = state
            .settings
            .lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        guard.clone()
    };

    match settings.tts_provider.as_str() {
        "elevenlabs" => get_elevenlabs_voices(&settings.tts_api_key).await,
        "none" | "" => Ok(Vec::new()),
        _ => Err(format!("Unknown TTS provider: {}", settings.tts_provider)),
    }
}

async fn get_elevenlabs_voices(api_key: &str) -> Result<Vec<TtsVoice>, String> {
    if api_key.is_empty() {
        return Err("ElevenLabs API key not configured".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get("https://api.elevenlabs.io/v1/voices")
        .header("xi-api-key", api_key)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch voices: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "ElevenLabs API error: HTTP {}",
            response.status()
        ));
    }

    let data: ElevenLabsVoicesResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data
        .voices
        .into_iter()
        .map(|v| TtsVoice {
            voice_id: v.voice_id,
            name: v.name,
            language: "multilingual".to_string(),
            provider: "elevenlabs".to_string(),
        })
        .collect())
}

#[tauri::command]
pub async fn generate_tts(
    state: State<'_, AppState>,
    text: String,
    phrase_id: Option<i64>,
) -> Result<String, String> {
    let settings = {
        let guard = state
            .settings
            .lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        guard.clone()
    };

    match settings.tts_provider.as_str() {
        "elevenlabs" => {
            generate_elevenlabs_tts(&settings.tts_api_key, &settings.tts_voice_id, &text, phrase_id)
                .await
        }
        "none" | "" => Err("TTS not configured".to_string()),
        _ => Err(format!("Unknown TTS provider: {}", settings.tts_provider)),
    }
}

async fn generate_elevenlabs_tts(
    api_key: &str,
    voice_id: &str,
    text: &str,
    phrase_id: Option<i64>,
) -> Result<String, String> {
    if api_key.is_empty() {
        return Err("ElevenLabs API key not configured".to_string());
    }

    if voice_id.is_empty() {
        return Err("ElevenLabs voice not selected".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!(
        "https://api.elevenlabs.io/v1/text-to-speech/{}",
        voice_id
    );

    let body = serde_json::json!({
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    });

    let response = client
        .post(&url)
        .header("xi-api-key", api_key)
        .header("Content-Type", "application/json")
        .header("Accept", "audio/mpeg")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to generate TTS: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("ElevenLabs API error: HTTP {} - {}", status, error_text));
    }

    let audio_bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read audio: {}", e))?;

    // Generate filename
    let audio_dir = get_audio_dir();
    let filename = if let Some(id) = phrase_id {
        format!("phrase_{}.mp3", id)
    } else {
        format!("tts_{}.mp3", chrono::Utc::now().timestamp_millis())
    };

    let audio_path = audio_dir.join(&filename);

    // Save audio file
    let mut file =
        File::create(&audio_path).map_err(|e| format!("Failed to create audio file: {}", e))?;

    file.write_all(&audio_bytes)
        .map_err(|e| format!("Failed to write audio file: {}", e))?;

    Ok(audio_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn test_tts_connection(state: State<'_, AppState>) -> Result<String, String> {
    let settings = {
        let guard = state
            .settings
            .lock()
            .map_err(|e| format!("Failed to lock settings: {}", e))?;
        guard.clone()
    };

    match settings.tts_provider.as_str() {
        "elevenlabs" => {
            let voices = get_elevenlabs_voices(&settings.tts_api_key).await?;
            Ok(format!(
                "Connection successful! Found {} voices.",
                voices.len()
            ))
        }
        "none" | "" => Err("TTS not configured".to_string()),
        _ => Err(format!("Unknown TTS provider: {}", settings.tts_provider)),
    }
}
