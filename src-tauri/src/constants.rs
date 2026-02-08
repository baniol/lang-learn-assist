//! Application-wide constants for magic numbers and configuration values.
//!
//! This module centralizes hardcoded values to improve maintainability and
//! make it easier to understand and adjust algorithm parameters.

/// SRS (Spaced Repetition System) algorithm constants
pub mod srs {
    /// Default ease factor for new phrases (SM-2 algorithm standard)
    pub const DEFAULT_EASE_FACTOR: f64 = 2.5;

    /// Minimum ease factor to prevent intervals from becoming too short
    pub const MIN_EASE_FACTOR: f64 = 1.3;

    /// Penalty applied to ease factor on incorrect answer
    pub const EASE_PENALTY: f64 = 0.2;

    /// Minimum correct streak to graduate from learning phase
    pub const LEARNING_GRADUATION_STREAK: i32 = 2;

    /// Minutes to wait before reviewing again during learning phase
    pub const LEARNING_REVIEW_MINUTES: i64 = 10;

    /// Minutes to wait before reviewing after incorrect answer
    pub const INCORRECT_REVIEW_MINUTES: i64 = 5;
}

/// Priority values for phrase selection
pub mod priority {
    /// Base priority for phrases due for review (adds overdue hours on top)
    pub const DUE_FOR_REVIEW_BASE: f64 = 2000.0;

    /// Priority for new phrases (never practiced)
    pub const NEW_PHRASE: f64 = 1000.0;

    /// Priority for phrases in learning phase (interval_days = 0, practiced but not graduated)
    /// These should always be available within a session for repetition
    pub const LEARNING_PHASE: f64 = 800.0;

    /// Priority for phrases with parsing errors in next_review_at
    pub const PARSE_ERROR: f64 = 500.0;

    /// Priority for phrases not yet due (should not be shown)
    pub const NOT_DUE: f64 = 0.0;
}

/// LLM (Large Language Model) token limits and settings
pub mod llm {
    /// Maximum tokens for phrase refinement
    pub const REFINE_PHRASE_MAX_TOKENS: i64 = 1000;

    /// Maximum tokens for title generation
    pub const TITLE_MAX_TOKENS: i64 = 50;

    /// Maximum tokens for testing connection
    pub const TEST_CONNECTION_MAX_TOKENS: i64 = 50;

    /// Maximum tokens for material processing per chunk
    pub const MATERIAL_CHUNK_MAX_TOKENS: i64 = 4000;

    /// Maximum tokens for asking about sentences
    pub const ASK_SENTENCE_MAX_TOKENS: i64 = 1500;

    /// Maximum input tokens per chunk for material processing
    pub const MAX_CHUNK_INPUT_TOKENS: usize = 1000;

    /// HTTP request timeout in seconds
    pub const REQUEST_TIMEOUT_SECS: u64 = 60;
}

/// Token estimation constants
pub mod tokens {
    /// Approximate characters per token for German text (conservative)
    pub const CHARS_PER_TOKEN_GERMAN: usize = 3;
}

/// Deck generation constants
pub mod deck_generation {
    /// Maximum phrases that can be generated in a single request
    pub const MAX_PHRASES_PER_GENERATION: i32 = 50;

    /// Default number of phrases to generate
    pub const DEFAULT_PHRASE_COUNT: i32 = 20;

    /// Minimum phrases to generate
    pub const MIN_PHRASE_COUNT: i32 = 5;

    /// Maximum tokens for deck generation LLM response
    pub const GENERATION_MAX_TOKENS: i64 = 4000;
}
