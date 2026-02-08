use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Learning status for phrases - determines where they are in the learning lifecycle
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LearningStatus {
    /// Phrase is not learnable yet - must be added to a deck first
    Inactive,
    /// Phrase is being learned in a deck (not yet graduated)
    DeckLearning,
    /// Phrase has graduated to SRS for long-term spaced repetition
    SrsActive,
}

impl Default for LearningStatus {
    fn default() -> Self {
        LearningStatus::Inactive
    }
}

impl LearningStatus {
    pub fn from_str(s: &str) -> Self {
        match s {
            "deck_learning" => LearningStatus::DeckLearning,
            "srs_active" => LearningStatus::SrsActive,
            _ => LearningStatus::Inactive,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            LearningStatus::Inactive => "inactive",
            LearningStatus::DeckLearning => "deck_learning",
            LearningStatus::SrsActive => "srs_active",
        }
    }
}

/// CEFR language proficiency levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CefrLevel {
    A1,
    A2,
    B1,
    B2,
    C1,
    C2,
}

impl CefrLevel {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "A1" => Some(CefrLevel::A1),
            "A2" => Some(CefrLevel::A2),
            "B1" => Some(CefrLevel::B1),
            "B2" => Some(CefrLevel::B2),
            "C1" => Some(CefrLevel::C1),
            "C2" => Some(CefrLevel::C2),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            CefrLevel::A1 => "A1",
            CefrLevel::A2 => "A2",
            CefrLevel::B1 => "B1",
            CefrLevel::B2 => "B2",
            CefrLevel::C1 => "C1",
            CefrLevel::C2 => "C2",
        }
    }

    pub fn description(&self) -> &'static str {
        match self {
            CefrLevel::A1 => "Beginner - basic phrases and expressions",
            CefrLevel::A2 => "Elementary - everyday situations",
            CefrLevel::B1 => "Intermediate - familiar topics and opinions",
            CefrLevel::B2 => "Upper Intermediate - complex topics and spontaneous interaction",
            CefrLevel::C1 => "Advanced - fluent expression and implicit meaning",
            CefrLevel::C2 => "Proficiency - near-native command",
        }
    }
}

/// Source type for deck content
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeckSourceType {
    /// AI-generated content
    AiGenerated,
    /// Imported from a deck pack file
    Imported,
    /// Fetched from an external API
    Api,
    /// Created manually by the user
    UserCreated,
}

impl DeckSourceType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "ai_generated" => Some(DeckSourceType::AiGenerated),
            "imported" => Some(DeckSourceType::Imported),
            "api" => Some(DeckSourceType::Api),
            "user_created" => Some(DeckSourceType::UserCreated),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            DeckSourceType::AiGenerated => "ai_generated",
            DeckSourceType::Imported => "imported",
            DeckSourceType::Api => "api",
            DeckSourceType::UserCreated => "user_created",
        }
    }
}

/// Deck source record - tracks origin of deck content
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckSource {
    pub id: i64,
    pub deck_id: i64,
    pub source_type: String,
    pub source_identifier: Option<String>,
    pub generated_at: Option<String>,
    pub metadata_json: Option<String>,
    pub created_at: String,
}

/// Request for AI deck generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateDeckRequest {
    pub name: String,
    pub description: Option<String>,
    pub level: String,
    pub category: Option<String>,
    pub phrase_count: i32,
    pub target_language: Option<String>,
    pub native_language: Option<String>,
}

/// Response from AI deck generation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateDeckResponse {
    pub deck: Deck,
    pub phrases_created: i32,
}

/// Study mode for unified learning commands
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StudyMode {
    /// Studying phrases in a specific deck
    #[serde(rename_all = "camelCase")]
    DeckLearning { deck_id: i64 },
    /// SRS review of graduated phrases
    SrsReview,
}

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
        _ => code,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Phrase {
    pub id: i64,
    pub conversation_id: Option<i64>,
    pub material_id: Option<i64>,
    pub deck_id: Option<i64>,
    pub prompt: String,
    pub answer: String,
    pub accepted: Vec<String>,
    pub target_language: String,
    pub native_language: String,
    pub audio_path: Option<String>,
    pub notes: Option<String>,
    pub starred: bool,
    pub excluded: bool,
    pub refined: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhraseProgress {
    pub id: i64,
    pub phrase_id: i64,
    pub correct_streak: i32,
    pub total_attempts: i32,
    pub success_count: i32,
    pub last_seen: Option<String>,
    // SRS fields
    pub ease_factor: f64,
    pub interval_days: i32,
    pub next_review_at: Option<String>,
    // Learning status - determines where phrase is in lifecycle
    pub learning_status: LearningStatus,
    // Deck graduation fields (deck_correct_count tracks progress toward graduation)
    pub deck_correct_count: i32,
    // Legacy field - kept for backwards compatibility during migration
    #[serde(default = "default_true")]
    pub in_srs_pool: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhraseWithProgress {
    pub phrase: Phrase,
    pub progress: Option<PhraseProgress>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PracticeSession {
    pub id: i64,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub total_phrases: i32,
    pub correct_answers: i32,
    pub exercise_mode: String,
    pub state: Option<SessionState>,
}

/// Session state for persistence across app restarts
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    pub seen_phrase_ids: Vec<i64>,
    pub session_streaks: HashMap<i64, i32>,
    pub session_learned_ids: Vec<i64>,
    pub new_phrase_count: i32,
    pub current_phrase_id: Option<i64>,
    pub in_retry_mode: bool,
    pub retry_count: i32,
    pub requires_retry: bool,
    // Deck study fields (optional, only used for deck study sessions)
    #[serde(default)]
    pub deck_id: Option<i64>,
    #[serde(default)]
    pub session_type: Option<String>,
}

// Deck models

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Deck {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub target_language: String,
    pub native_language: String,
    pub graduation_threshold: i32,
    // Future metadata fields for levels/themes
    pub level: Option<String>,
    pub category: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckWithStats {
    pub deck: Deck,
    pub total_phrases: i32,
    pub graduated_count: i32,
    pub learning_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDeckRequest {
    pub name: String,
    pub description: Option<String>,
    pub target_language: Option<String>,
    pub native_language: Option<String>,
    pub graduation_threshold: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDeckRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub graduation_threshold: Option<i32>,
}

/// Result of recording an answer in deck study mode
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckAnswerResult {
    pub progress: PhraseProgress,
    pub deck_correct_count: i32,
    pub just_graduated: bool,
    pub graduation_threshold: i32,
}

/// Unified result of recording an answer in study mode (both deck and SRS)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyAnswerResult {
    pub progress: PhraseProgress,
    // SRS-specific fields
    pub session_streak: Option<i32>,
    pub is_learned_in_session: Option<bool>,
    // Deck-specific fields
    pub deck_correct_count: Option<i32>,
    pub just_graduated: Option<bool>,
    pub graduation_threshold: Option<i32>,
}

impl From<AnswerResult> for StudyAnswerResult {
    fn from(result: AnswerResult) -> Self {
        StudyAnswerResult {
            progress: result.progress,
            session_streak: Some(result.session_streak),
            is_learned_in_session: Some(result.is_learned_in_session),
            deck_correct_count: None,
            just_graduated: None,
            graduation_threshold: None,
        }
    }
}

impl From<DeckAnswerResult> for StudyAnswerResult {
    fn from(result: DeckAnswerResult) -> Self {
        StudyAnswerResult {
            progress: result.progress,
            session_streak: None,
            is_learned_in_session: None,
            deck_correct_count: Some(result.deck_correct_count),
            just_graduated: Some(result.just_graduated),
            graduation_threshold: Some(result.graduation_threshold),
        }
    }
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

    // Learning settings
    pub required_streak: i32,
    pub immediate_retry: bool,
    pub default_exercise_mode: String,
    pub failure_repetitions: i32,
    pub session_phrase_limit: i32,
    pub new_phrases_per_session: i32,
    pub new_phrase_interval: i32,
    pub fuzzy_matching: bool,
    pub notes_enabled: bool,
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
            required_streak: 2,
            immediate_retry: true,
            default_exercise_mode: "speaking".to_string(),
            failure_repetitions: 2,
            session_phrase_limit: 20,
            new_phrases_per_session: 2,
            new_phrase_interval: 4,
            fuzzy_matching: true,
            notes_enabled: false,
        }
    }
}

// Notes

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteRequest {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoteRequest {
    pub content: String,
}

/// Result of recording an answer - includes session-level streak tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnswerResult {
    pub progress: PhraseProgress,
    pub session_streak: i32,
    pub is_learned_in_session: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningStats {
    pub total_phrases: i32,
    pub learned_count: i32,
    pub learning_count: i32,
    pub new_count: i32,
    pub average_success_rate: f64,
    pub total_sessions: i32,
    // Deck-specific stats
    pub in_decks_count: i32,
    pub graduated_to_srs_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SrsStats {
    pub due_now: i32,
    pub overdue: i32,
    pub due_today: i32,
    pub due_tomorrow: i32,
    pub due_this_week: i32,
    pub total_reviews: i32,
    pub average_ease_factor: f64,
    pub interval_distribution: IntervalDistribution,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntervalDistribution {
    pub one_day: i32,
    pub two_to_three_days: i32,
    pub four_to_seven_days: i32,
    pub one_to_two_weeks: i32,
    pub two_weeks_plus: i32,
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

// Question threads for grammar/style Q&A

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionThread {
    pub id: i64,
    pub title: String,
    pub target_language: String,
    pub native_language: String,
    pub messages: Vec<QuestionMessage>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub examples: Option<Vec<QuestionExample>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionExample {
    pub sentence: String,
    pub translation: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrammarQuestionResponse {
    pub explanation: String,
    pub examples: Vec<QuestionExample>,
}

// Export/Import types

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportData {
    pub version: i32,
    pub exported_at: String,
    pub settings: Vec<ExportSetting>,
    pub phrases: Vec<ExportPhrase>,
    pub phrase_progress: Vec<ExportPhraseProgress>,
    pub phrase_threads: Vec<ExportPhraseThread>,
    pub question_threads: Vec<ExportQuestionThread>,
    pub notes: Vec<ExportNote>,
    pub practice_sessions: Vec<ExportPracticeSession>,
    #[serde(default)]
    pub materials: Vec<ExportMaterial>,
    #[serde(default)]
    pub material_threads: Vec<ExportMaterialThread>,
    #[serde(default)]
    pub decks: Vec<ExportDeck>,
    #[serde(default)]
    pub deck_sources: Vec<ExportDeckSource>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSetting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPhrase {
    pub id: i64,
    pub conversation_id: Option<i64>,
    pub material_id: Option<i64>,
    #[serde(default)]
    pub deck_id: Option<i64>,
    pub prompt: String,
    pub answer: String,
    pub accepted_json: String,
    pub target_language: String,
    pub native_language: String,
    pub audio_path: Option<String>,
    pub notes: Option<String>,
    pub starred: bool,
    pub excluded: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPhraseProgress {
    pub id: i64,
    pub phrase_id: i64,
    pub correct_streak: i32,
    pub total_attempts: i32,
    pub success_count: i32,
    pub last_seen: Option<String>,
    pub ease_factor: f64,
    pub interval_days: i32,
    pub next_review_at: Option<String>,
    #[serde(default = "export_default_true")]
    pub in_srs_pool: bool,
    #[serde(default)]
    pub deck_correct_count: i32,
    #[serde(default = "export_default_learning_status")]
    pub learning_status: String,
}

fn export_default_true() -> bool {
    true
}

fn export_default_learning_status() -> String {
    "inactive".to_string()
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportQuestionThread {
    pub id: i64,
    pub title: String,
    pub target_language: String,
    pub native_language: String,
    pub messages_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportNote {
    pub id: i64,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPracticeSession {
    pub id: i64,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub total_phrases: i32,
    pub correct_answers: i32,
    pub exercise_mode: String,
    pub state_json: Option<String>,
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
    pub phrase_progress_imported: i32,
    pub phrase_threads_imported: i32,
    pub question_threads_imported: i32,
    pub notes_imported: i32,
    pub practice_sessions_imported: i32,
    pub materials_imported: i32,
    pub material_threads_imported: i32,
    pub decks_imported: i32,
    pub deck_sources_imported: i32,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDeck {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub target_language: String,
    pub native_language: String,
    pub graduation_threshold: i32,
    #[serde(default)]
    pub level: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDeckSource {
    pub id: i64,
    pub deck_id: i64,
    pub source_type: String,
    pub source_identifier: Option<String>,
    pub generated_at: Option<String>,
    pub metadata_json: Option<String>,
    pub created_at: String,
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
