use crate::models::AppSettings;
use std::path::PathBuf;
use std::sync::Mutex;
use whisper_rs::WhisperContext;

pub struct AppState {
    pub settings: Mutex<AppSettings>,
    pub whisper_context: Mutex<Option<WhisperContext>>,
    pub whisper_model_path: Mutex<Option<PathBuf>>,
}

impl AppState {
    pub fn new(settings: AppSettings) -> Self {
        Self {
            settings: Mutex::new(settings),
            whisper_context: Mutex::new(None),
            whisper_model_path: Mutex::new(None),
        }
    }
}
