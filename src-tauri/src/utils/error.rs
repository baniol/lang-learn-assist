//! Unified error handling for the application.
//!
//! Provides a centralized AppError type that can represent various error conditions
//! throughout the application, with automatic conversion to user-friendly error messages.

use thiserror::Error;

/// Unified application error type.
///
/// This enum represents all possible errors that can occur in the application,
/// providing consistent error handling and user-friendly messages.
#[derive(Error, Debug)]
pub enum AppError {
    /// Database-related errors (SQLite)
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    /// Lock acquisition failures (mutex/rwlock poisoned)
    #[error("Lock error: {0}")]
    Lock(String),

    /// JSON serialization/deserialization errors
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// HTTP request errors (LLM API calls)
    #[error("HTTP error: {0}")]
    Http(String),

    /// File I/O errors
    #[error("File error: {0}")]
    Io(#[from] std::io::Error),

    /// Resource not found (phrase, conversation, etc.)
    #[error("{resource_type} not found: {id}")]
    NotFound { resource_type: String, id: String },

    /// Configuration errors (missing API key, invalid settings)
    #[error("Configuration error: {0}")]
    Config(String),

    /// Validation errors (invalid input)
    #[error("Validation error: {0}")]
    Validation(String),

    /// External service errors (Whisper, TTS, etc.)
    #[error("Service error: {0}")]
    Service(String),

    /// Generic application errors
    #[error("{0}")]
    Other(String),
}

impl AppError {
    /// Create a not found error for a specific resource type.
    pub fn not_found<T: Into<String>, I: Into<String>>(resource_type: T, id: I) -> Self {
        AppError::NotFound {
            resource_type: resource_type.into(),
            id: id.into(),
        }
    }

    /// Create a configuration error.
    pub fn config<T: Into<String>>(message: T) -> Self {
        AppError::Config(message.into())
    }

    /// Create a validation error.
    pub fn validation<T: Into<String>>(message: T) -> Self {
        AppError::Validation(message.into())
    }

    /// Create a lock error.
    pub fn lock<T: Into<String>>(message: T) -> Self {
        AppError::Lock(message.into())
    }

    /// Create an HTTP error.
    pub fn http<T: Into<String>>(message: T) -> Self {
        AppError::Http(message.into())
    }

    /// Create a service error.
    pub fn service<T: Into<String>>(message: T) -> Self {
        AppError::Service(message.into())
    }
}

// Convert AppError to String for Tauri command compatibility
impl From<AppError> for String {
    fn from(error: AppError) -> String {
        error.to_string()
    }
}

// Allow creating AppError from string slices
impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Other(s.to_string())
    }
}

// Allow creating AppError from String
impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Other(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_not_found_error() {
        let error = AppError::not_found("Phrase", "42");
        assert_eq!(error.to_string(), "Phrase not found: 42");
    }

    #[test]
    fn test_config_error() {
        let error = AppError::config("API key not configured");
        assert_eq!(error.to_string(), "Configuration error: API key not configured");
    }

    #[test]
    fn test_validation_error() {
        let error = AppError::validation("Invalid input");
        assert_eq!(error.to_string(), "Validation error: Invalid input");
    }

    #[test]
    fn test_error_to_string_conversion() {
        let error = AppError::config("test");
        let s: String = error.into();
        assert!(s.contains("Configuration error"));
    }

    #[test]
    fn test_from_string() {
        let error: AppError = "custom error".into();
        assert_eq!(error.to_string(), "custom error");
    }
}
