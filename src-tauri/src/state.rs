use crate::models::AppSettings;
use std::path::PathBuf;
use std::sync::{Mutex, RwLock};
use whisper_rs::WhisperContext;

pub struct AppState {
    /// Application settings - use RwLock since settings are read-heavy.
    /// Use safe_read() for reading settings and safe_write() for modifications.
    pub settings: RwLock<AppSettings>,
    /// Whisper context for speech-to-text transcription.
    pub whisper_context: Mutex<Option<WhisperContext>>,
    /// Path to the currently loaded Whisper model.
    pub whisper_model_path: Mutex<Option<PathBuf>>,
}

impl AppState {
    pub fn new(settings: AppSettings) -> Self {
        Self {
            settings: RwLock::new(settings),
            whisper_context: Mutex::new(None),
            whisper_model_path: Mutex::new(None),
        }
    }
}
