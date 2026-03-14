use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Convert language code to human-readable name
pub fn get_language_name(code: &str) -> &str {
    match code {
        "de" => "German",
        "en" => "English",
        "fr" => "French",
        "es" => "Spanish",
        "it" => "Italian",
        "pl" => "Polish",
        "pt" => "Portuguese",
        "ru" => "Russian",
        "zh" => "Chinese",
        "ja" => "Japanese",
        "ko" => "Korean",
        "cs" => "Czech",
        "uk" => "Ukrainian",
        _ => code,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Phrase {
    pub id: i64,
    pub material_id: Option<i64>,
    pub prompt: String,
    pub answer: String,
    pub accepted: Vec<String>,
    pub target_language: String,
    pub native_language: String,
    pub audio_path: Option<String>,
    pub notes: Option<String>,
    pub starred: bool,
    pub refined: bool,
    pub created_at: String,
}

/// Voice settings for a specific language (default voice + conversation voices A/B)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LanguageVoiceSettings {
    pub default: String,
    pub voice_a: String,
    pub voice_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    // LLM settings
    pub llm_provider: String,
    pub llm_api_key: String,
    pub llm_model: String,

    // Whisper settings
    pub active_whisper_model: String,

    // TTS settings
    pub tts_provider: String,
    pub tts_api_key: String,
    // Legacy voice settings (kept for migration, may be empty)
    pub tts_voice_id: String,
    pub tts_voice_id_a: String,
    pub tts_voice_id_b: String,
    // Per-language voice settings
    pub tts_voices_per_language: HashMap<String, LanguageVoiceSettings>,

    // Language settings
    pub target_language: String,
    pub native_language: String,

    // App settings
    pub fuzzy_matching: bool,
}

impl AppSettings {
    pub fn with_defaults() -> Self {
        Self {
            llm_provider: "anthropic".to_string(),
            llm_api_key: String::new(),
            llm_model: "claude-sonnet-4-20250514".to_string(),
            active_whisper_model: "ggml-base.bin".to_string(),
            tts_provider: "none".to_string(),
            tts_api_key: String::new(),
            tts_voice_id: String::new(),
            tts_voice_id_a: String::new(),
            tts_voice_id_b: String::new(),
            tts_voices_per_language: HashMap::new(),
            target_language: "de".to_string(),
            native_language: "pl".to_string(),
            fuzzy_matching: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestedPhrase {
    pub prompt: String,
    pub answer: String,
    #[serde(default)]
    pub accepted: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePhraseRequest {
    pub material_id: Option<i64>,
    pub prompt: String,
    pub answer: String,
    pub accepted: Option<Vec<String>>,
    pub target_language: Option<String>,
    pub native_language: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePhraseRequest {
    pub prompt: Option<String>,
    pub answer: Option<String>,
    pub accepted: Option<Vec<String>>,
    pub notes: Option<String>,
    pub starred: Option<bool>,
    pub refined: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhraseThread {
    pub id: i64,
    pub phrase_id: i64,
    pub messages: Vec<PhraseThreadMessage>,
    pub suggested_prompt: Option<String>,
    pub suggested_answer: Option<String>,
    pub suggested_accepted: Option<Vec<String>>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhraseThreadMessage {
    pub id: String,
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefinePhraseSuggestion {
    pub prompt: Option<String>,
    pub answer: Option<String>,
    pub accepted: Option<Vec<String>>,
    pub explanation: String,
}

// Export/Import types

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportData {
    pub version: i32,
    pub exported_at: String,
    pub settings: Vec<ExportSetting>,
    pub phrases: Vec<ExportPhrase>,
    pub phrase_threads: Vec<ExportPhraseThread>,
    #[serde(default)]
    pub question_threads: Vec<serde_json::Value>,
    #[serde(default)]
    pub notes: Vec<serde_json::Value>,
    #[serde(default)]
    pub materials: Vec<ExportMaterial>,
    #[serde(default)]
    pub material_threads: Vec<ExportMaterialThread>,
    // Legacy fields - accepted during import but no longer exported
    #[serde(default)]
    pub phrase_progress: Vec<serde_json::Value>,
    #[serde(default)]
    pub practice_sessions: Vec<serde_json::Value>,
    #[serde(default)]
    pub decks: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSetting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ExportPhrase {
    pub id: i64,
    #[serde(default, skip_serializing)]
    pub conversation_id: Option<i64>, // Deprecated, kept for import compatibility
    pub material_id: Option<i64>,
    pub prompt: String,
    pub answer: String,
    pub accepted_json: String,
    pub target_language: String,
    pub native_language: String,
    pub audio_path: Option<String>,
    pub notes: Option<String>,
    pub starred: bool,
    #[serde(default, skip_serializing)]
    pub excluded: Option<bool>, // Deprecated, kept for import compatibility
    pub created_at: String,
    // Legacy fields - accepted during import but ignored
    #[serde(default, skip_serializing)]
    pub deck_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPhraseThread {
    pub id: i64,
    pub phrase_id: i64,
    pub messages_json: String,
    pub suggested_prompt: Option<String>,
    pub suggested_answer: Option<String>,
    pub suggested_accepted: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportMode {
    Merge,
    Overwrite,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: bool,
    pub message: String,
    pub stats: ImportStats,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportStats {
    pub settings_imported: i32,
    pub phrases_imported: i32,
    pub phrases_updated: i32,
    pub phrase_threads_imported: i32,
    pub materials_imported: i32,
    pub material_threads_imported: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportMaterial {
    pub id: i64,
    pub title: String,
    pub material_type: String,
    pub source_url: Option<String>,
    pub original_text: String,
    pub segments_json: Option<String>,
    pub target_language: String,
    pub native_language: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportMaterialThread {
    pub id: i64,
    pub material_id: i64,
    pub segment_index: i32,
    pub messages_json: String,
    pub suggested_phrases_json: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// Materials (YouTube transcripts, articles, etc.)

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Material {
    pub id: i64,
    pub title: String,
    pub material_type: String,
    pub source_url: Option<String>,
    pub original_text: String,
    pub segments_json: Option<String>,
    pub target_language: String,
    pub native_language: String,
    pub status: String,
    pub bookmark_index: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMaterialRequest {
    pub title: String,
    pub material_type: String,
    pub source_url: Option<String>,
    pub original_text: String,
    pub target_language: Option<String>,
    pub native_language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMaterialRequest {
    pub title: Option<String>,
    pub segments_json: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextSegment {
    pub text: String,
    pub translation: String,
    #[serde(default)]
    pub timestamp: Option<String>,
    #[serde(default)]
    pub audio_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialThread {
    pub id: i64,
    pub material_id: i64,
    pub segment_index: i32,
    pub messages: Vec<MaterialThreadMessage>,
    pub suggested_phrases: Option<Vec<SuggestedPhrase>>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialThreadMessage {
    pub id: String,
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskAboutSentenceResponse {
    pub explanation: String,
    pub phrases: Vec<SuggestedPhrase>,
}

/// Translation preview for phrase translation feature
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationPreview {
    pub phrase_id: i64,
    pub original_answer: String,
    pub translated_answer: String,
    pub original_accepted: Vec<String>,
    pub translated_accepted: Vec<String>,
    pub new_target_language: String,
}
