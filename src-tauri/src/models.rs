use serde::{Deserialize, Serialize};

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
pub struct Conversation {
    pub id: i64,
    pub title: String,
    pub subject: String,
    pub target_language: String,
    pub native_language: String,
    pub status: String,
    pub raw_messages_json: String,
    pub final_messages_json: Option<String>,
    pub llm_summary: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Phrase {
    pub id: i64,
    pub conversation_id: Option<i64>,
    pub prompt: String,
    pub answer: String,
    pub accepted: Vec<String>,
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
    pub tts_voice_id: String,

    // Language settings
    pub target_language: String,
    pub native_language: String,

    // Learning settings
    pub required_streak: i32,
    pub immediate_retry: bool,
    pub default_exercise_mode: String,
    pub failure_repetitions: i32,
    pub session_phrase_limit: i32,
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
            target_language: "de".to_string(),
            native_language: "pl".to_string(),
            required_streak: 2,
            immediate_retry: true,
            default_exercise_mode: "speaking".to_string(),
            failure_repetitions: 2,
            session_phrase_limit: 20,
        }
    }
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
pub struct ConversationCleanupResult {
    pub title: String,
    pub cleaned_messages: Vec<ChatMessage>,
    pub suggested_phrases: Vec<SuggestedPhrase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestedPhrase {
    pub prompt: String,
    pub answer: String,
    pub accepted: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateConversationRequest {
    pub title: String,
    pub subject: String,
    pub target_language: Option<String>,
    pub native_language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePhraseRequest {
    pub conversation_id: Option<i64>,
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
