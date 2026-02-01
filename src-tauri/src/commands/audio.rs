use crate::state::AppState;
use futures_util::StreamExt;
use serde::Serialize;
use std::path::PathBuf;
use tauri::{Emitter, Manager, State};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Whisper model metadata
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WhisperModel {
    pub name: &'static str,
    pub file_name: &'static str,
    pub size_mb: u32,
    pub url: &'static str,
    pub description: &'static str,
}

/// Download progress event payload
#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percent: f32,
}

/// Available Whisper models
pub const AVAILABLE_MODELS: &[WhisperModel] = &[
    WhisperModel {
        name: "Tiny",
        file_name: "ggml-tiny.bin",
        size_mb: 75,
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        description: "Fastest, lower accuracy",
    },
    WhisperModel {
        name: "Base",
        file_name: "ggml-base.bin",
        size_mb: 142,
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        description: "Balanced (default)",
    },
    WhisperModel {
        name: "Small",
        file_name: "ggml-small.bin",
        size_mb: 466,
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        description: "Better quality, slower",
    },
];

/// Get list of available Whisper models
#[tauri::command]
pub fn get_available_models() -> Vec<WhisperModel> {
    AVAILABLE_MODELS.to_vec()
}

/// Check if a specific model is downloaded
#[tauri::command]
pub fn get_model_status(app: tauri::AppHandle, file_name: String) -> bool {
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let model_path = app_data_dir.join("models").join(&file_name);
        model_path.exists()
    } else {
        false
    }
}

/// Check if active model file exists
#[tauri::command]
pub fn is_model_downloaded(app: tauri::AppHandle, state: State<'_, AppState>) -> bool {
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let settings = state.settings.lock().unwrap();
        let active_model = &settings.active_whisper_model;
        let model_path = app_data_dir.join("models").join(active_model);
        model_path.exists()
    } else {
        false
    }
}

/// Check if whisper is initialized
#[tauri::command]
pub fn is_whisper_ready(state: State<'_, AppState>) -> bool {
    state.whisper_context.lock().unwrap().is_some()
}

/// Download whisper model with progress events
#[tauri::command]
pub async fn download_model(app: tauri::AppHandle, file_name: String) -> Result<String, String> {
    // Find model in available models list
    let model = AVAILABLE_MODELS
        .iter()
        .find(|m| m.file_name == file_name)
        .ok_or_else(|| format!("Unknown model: {}", file_name))?;

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let models_dir = app_data_dir.join("models");
    std::fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;

    let model_path = models_dir.join(&file_name);

    // Return early if model already exists
    if model_path.exists() {
        return Ok(model_path.to_string_lossy().to_string());
    }

    // Download model
    let client = reqwest::Client::new();
    let response = client
        .get(model.url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {e}"))?;

    let total_size = response.content_length().unwrap_or(0);

    // Create temp file for download
    let temp_path = model_path.with_extension("bin.tmp");
    let mut file = std::fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {e}"))?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {e}"))?;
        std::io::Write::write_all(&mut file, &chunk)
            .map_err(|e| format!("Failed to write chunk: {e}"))?;

        downloaded += chunk.len() as u64;

        // Emit progress event
        let percent = if total_size > 0 {
            (downloaded as f32 / total_size as f32) * 100.0
        } else {
            0.0
        };

        let _ = app.emit(
            "model-download-progress",
            DownloadProgress {
                downloaded,
                total: total_size,
                percent,
            },
        );
    }

    // Rename temp file to final path
    std::fs::rename(&temp_path, &model_path)
        .map_err(|e| format!("Failed to finalize download: {e}"))?;

    Ok(model_path.to_string_lossy().to_string())
}

/// Delete a model from disk
#[tauri::command]
pub fn delete_model(
    app: tauri::AppHandle,
    file_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Check if this model is currently loaded
    let current_model_path = state.whisper_model_path.lock().unwrap();
    if let Some(ref loaded_path) = *current_model_path {
        if loaded_path.file_name().and_then(|n| n.to_str()) == Some(&file_name) {
            return Err("Cannot delete the currently active model".to_string());
        }
    }
    drop(current_model_path);

    // Delete the model file
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let model_path = app_data_dir.join("models").join(&file_name);

    if !model_path.exists() {
        return Err(format!("Model {} not found", file_name));
    }

    std::fs::remove_file(&model_path).map_err(|e| format!("Failed to delete model: {}", e))?;

    Ok(())
}

/// Initialize whisper model
#[tauri::command]
pub fn init_whisper(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let models_dir = app_data_dir.join("models");
    std::fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;

    // Get active model from settings
    let active_model = {
        let settings = state.settings.lock().map_err(|e| e.to_string())?;
        settings.active_whisper_model.clone()
    };

    let model_path = models_dir.join(&active_model);

    // Check if model exists
    if !model_path.exists() {
        return Err(format!(
            "Model {} not downloaded. Please download it first.",
            active_model
        ));
    }

    // Initialize whisper context
    let ctx = WhisperContext::new_with_params(
        model_path.to_str().ok_or("Invalid model path")?,
        WhisperContextParameters::default(),
    )
    .map_err(|e| format!("Failed to load whisper model: {e}"))?;

    *state.whisper_context.lock().unwrap() = Some(ctx);
    *state.whisper_model_path.lock().unwrap() = Some(model_path);

    Ok(())
}

/// Transcribe audio file and return text
///
/// The `prompt` parameter provides hints to Whisper about expected words/phrases,
/// which significantly improves accuracy for specific vocabulary (e.g., French phrases).
#[tauri::command]
pub fn transcribe_audio(
    audio_path: String,
    language: Option<String>,
    prompt: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let path = PathBuf::from(&audio_path);
    if !path.exists() {
        return Err(format!("Audio file not found: {audio_path}"));
    }

    // Check file size
    let file_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    if file_size < 100 {
        return Err(format!(
            "Audio file too small ({file_size} bytes). Microphone permission may be denied."
        ));
    }

    // Read WAV file
    let reader = hound::WavReader::open(&path).map_err(|e| format!("Failed to read WAV: {e}"))?;
    let spec = reader.spec();

    // Read samples based on format
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => {
            if spec.channels == 1 {
                reader
                    .into_samples::<i16>()
                    .filter_map(Result::ok)
                    .map(|s| f32::from(s) / f32::from(i16::MAX))
                    .collect()
            } else {
                // Convert stereo to mono by averaging channels
                let all_samples: Vec<i16> = reader
                    .into_samples::<i16>()
                    .filter_map(Result::ok)
                    .collect();
                all_samples
                    .chunks(spec.channels as usize)
                    .map(|chunk| {
                        let sum: i32 = chunk.iter().map(|&s| i32::from(s)).sum();
                        let avg = sum / chunk.len() as i32;
                        avg as f32 / f32::from(i16::MAX)
                    })
                    .collect()
            }
        }
        hound::SampleFormat::Float => {
            if spec.channels == 1 {
                reader
                    .into_samples::<f32>()
                    .filter_map(Result::ok)
                    .collect()
            } else {
                let all_samples: Vec<f32> = reader
                    .into_samples::<f32>()
                    .filter_map(Result::ok)
                    .collect();
                all_samples
                    .chunks(spec.channels as usize)
                    .map(|chunk| chunk.iter().sum::<f32>() / chunk.len() as f32)
                    .collect()
            }
        }
    };

    if samples.is_empty() {
        return Err("No audio samples in file. Recording may have failed.".to_string());
    }

    // Resample to 16kHz if needed (Whisper requires exactly 16kHz sample rate)
    let samples = if spec.sample_rate != 16000 {
        let ratio = 16000.0 / spec.sample_rate as f64;
        let new_len = (samples.len() as f64 * ratio) as usize;
        let mut resampled = Vec::with_capacity(new_len);

        for i in 0..new_len {
            let src_idx = i as f64 / ratio;
            let idx = src_idx as usize;
            let frac = src_idx - idx as f64;

            let sample = if idx + 1 < samples.len() {
                samples[idx] * (1.0 - frac as f32) + samples[idx + 1] * frac as f32
            } else {
                samples[idx.min(samples.len() - 1)]
            };
            resampled.push(sample);
        }

        resampled
    } else {
        samples
    };

    // Get whisper context
    let ctx_guard = state.whisper_context.lock().unwrap();
    let ctx = ctx_guard
        .as_ref()
        .ok_or("Whisper not initialized. Call init_whisper first.")?;

    // Create state for transcription
    let mut whisper_state = ctx
        .create_state()
        .map_err(|e| format!("Failed to create state: {e}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    // Use specified language or auto-detect
    let lang = language.as_deref().unwrap_or("auto");
    params.set_language(Some(lang));
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);

    // Set initial prompt to guide transcription toward expected words/phrases
    if let Some(ref hint) = prompt {
        params.set_initial_prompt(hint);
    }

    whisper_state
        .full(params, &samples)
        .map_err(|e| format!("Transcription failed: {e}"))?;

    // Collect transcription
    let num_segments = whisper_state
        .full_n_segments()
        .map_err(|e| format!("Failed to get segments: {e}"))?;

    let mut text = String::new();
    for i in 0..num_segments {
        if let Ok(segment) = whisper_state.full_get_segment_text(i) {
            text.push_str(&segment);
        }
    }

    // Clean up audio file
    let _ = std::fs::remove_file(&path);

    Ok(text.trim().to_string())
}
