//! Application-wide constants for magic numbers and configuration values.
//!
//! This module centralizes hardcoded values to improve maintainability and
//! make it easier to understand and adjust algorithm parameters.

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

    /// Maximum tokens for phrase translation
    pub const TRANSLATE_PHRASE_MAX_TOKENS: i64 = 500;

    /// Maximum input tokens per chunk for material processing
    pub const MAX_CHUNK_INPUT_TOKENS: usize = 1000;

    /// HTTP request timeout in seconds
    pub const REQUEST_TIMEOUT_SECS: u64 = 60;
}

/// Practice session settings
pub mod practice {
    /// Maximum tokens of material context to include in practice prompts
    pub const MATERIAL_CONTEXT_MAX_TOKENS: usize = 3000;

    /// Maximum tokens for practice LLM responses
    pub const PRACTICE_RESPONSE_MAX_TOKENS: i64 = 1500;
}

/// Token estimation constants
pub mod tokens {
    /// Approximate characters per token for German text (conservative)
    pub const CHARS_PER_TOKEN_GERMAN: usize = 3;
}
