use crate::db::get_audio_dir;
use crate::state::AppState;
use crate::utils::lock::SafeRwLock;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
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
    pub preview_url: Option<String>,
}

#[derive(Deserialize)]
struct ElevenLabsVoice {
    voice_id: String,
    name: String,
    preview_url: Option<String>,
}

#[derive(Deserialize)]
struct ElevenLabsVoicesResponse {
    voices: Vec<ElevenLabsVoice>,
}

#[tauri::command]
pub async fn get_available_voices(state: State<'_, AppState>) -> Result<Vec<TtsVoice>, String> {
    let settings = state.settings.safe_read()?.clone();

    match settings.tts_provider.as_str() {
        "elevenlabs" => get_elevenlabs_voices(&settings.tts_api_key).await,
        "none" | "" => Ok(Vec::new()),
        _ => Err(format!("Unknown TTS provider: {}", settings.tts_provider)),
    }
}

async fn get_elevenlabs_voices(api_key: &str) -> Result<Vec<TtsVoice>, String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err("ElevenLabs API key not configured".to_string());
    }

    // Debug: log key length and prefix
    eprintln!(
        "[TTS Debug] API key length: {}, prefix: {}...",
        api_key.len(),
        &api_key[..api_key.len().min(10)]
    );

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
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        eprintln!("[TTS Debug] Error response body: {}", body);
        return Err(format!("ElevenLabs API error: HTTP {} - {}", status, body));
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
            preview_url: v.preview_url,
        })
        .collect())
}

/// Resolves the voice ID to use based on priority:
/// 1. Explicit voice_id parameter
/// 2. Per-language default voice (if language provided)
/// 3. Legacy global voice (tts_voice_id)
fn resolve_voice_id(
    explicit_voice_id: Option<&String>,
    language: Option<&String>,
    settings: &crate::models::AppSettings,
) -> String {
    // Priority 1: Explicit voice_id
    if let Some(voice_id) = explicit_voice_id {
        if !voice_id.is_empty() {
            return voice_id.clone();
        }
    }

    // Priority 2: Per-language default voice
    if let Some(lang) = language {
        if let Some(lang_settings) = settings.tts_voices_per_language.get(lang) {
            if !lang_settings.default.is_empty() {
                return lang_settings.default.clone();
            }
        }
    }

    // Priority 3: Legacy global voice
    settings.tts_voice_id.clone()
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn generate_tts(
    state: State<'_, AppState>,
    text: String,
    phrase_id: Option<i64>,
    voice_id: Option<String>,
    language: Option<String>,
    forceRegenerate: Option<bool>,
) -> Result<String, String> {
    let settings = state.settings.safe_read()?.clone();

    // Resolve voice ID with priority: explicit > per-language > legacy global
    let effective_voice_id = resolve_voice_id(voice_id.as_ref(), language.as_ref(), &settings);
    let force = forceRegenerate.unwrap_or(false);

    match settings.tts_provider.as_str() {
        "elevenlabs" => {
            generate_elevenlabs_tts(
                &settings.tts_api_key,
                &effective_voice_id,
                &text,
                phrase_id,
                force,
            )
            .await
        }
        "none" | "" => Err("TTS not configured".to_string()),
        _ => Err(format!("Unknown TTS provider: {}", settings.tts_provider)),
    }
}

/// Get the configured voice ID for a specific language
#[tauri::command]
pub fn get_voice_for_language(
    state: State<'_, AppState>,
    language: String,
) -> Result<String, String> {
    let settings = state.settings.safe_read()?;

    if let Some(lang_settings) = settings.tts_voices_per_language.get(&language) {
        if !lang_settings.default.is_empty() {
            return Ok(lang_settings.default.clone());
        }
    }

    // Fall back to legacy global voice
    Ok(settings.tts_voice_id.clone())
}

async fn generate_elevenlabs_tts(
    api_key: &str,
    voice_id: &str,
    text: &str,
    phrase_id: Option<i64>,
    force: bool,
) -> Result<String, String> {
    let api_key = api_key.trim();
    let voice_id = voice_id.trim();

    if api_key.is_empty() {
        return Err("ElevenLabs API key not configured".to_string());
    }

    if voice_id.is_empty() {
        return Err("ElevenLabs voice not selected".to_string());
    }

    // Generate filename - use phrase_id if available, otherwise hash text+voice for caching
    let audio_dir = get_audio_dir();
    let filename = if let Some(id) = phrase_id {
        format!("phrase_{}.mp3", id)
    } else {
        // Create a hash of text + voice_id for consistent filenames
        let mut hasher = Sha256::new();
        hasher.update(text.as_bytes());
        hasher.update(b"::");
        hasher.update(voice_id.as_bytes());
        let hash = hasher.finalize();
        // Format hash as hex string, use first 16 chars for shorter filename
        let hash_hex: String = hash.iter().map(|b| format!("{:02x}", b)).collect();
        format!("conv_{}.mp3", &hash_hex[..16])
    };

    let audio_path = audio_dir.join(&filename);

    // Delete existing file if force regeneration is requested
    if force && audio_path.exists() {
        let _ = std::fs::remove_file(&audio_path);
    }

    // Check if file already exists (cache hit)
    if audio_path.exists() {
        return Ok(audio_path.to_string_lossy().to_string());
    }

    // File doesn't exist, generate new audio
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let url = format!("https://api.elevenlabs.io/v1/text-to-speech/{}", voice_id);

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
        return Err(format!(
            "ElevenLabs API error: HTTP {} - {}",
            status, error_text
        ));
    }

    let audio_bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read audio: {}", e))?;

    // Save audio file
    let mut file =
        File::create(&audio_path).map_err(|e| format!("Failed to create audio file: {}", e))?;

    file.write_all(&audio_bytes)
        .map_err(|e| format!("Failed to write audio file: {}", e))?;

    Ok(audio_path.to_string_lossy().to_string())
}

use base64::{engine::general_purpose::STANDARD, Engine};

#[tauri::command]
pub async fn get_audio_base64(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read audio file: {}", e))?;
    Ok(format!(
        "data:audio/mpeg;base64,{}",
        STANDARD.encode(&bytes)
    ))
}

#[tauri::command]
pub async fn test_tts_connection(state: State<'_, AppState>) -> Result<String, String> {
    let settings = state.settings.safe_read()?.clone();

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
