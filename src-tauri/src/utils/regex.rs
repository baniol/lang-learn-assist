//! Lazy static regex patterns to avoid recompilation on each use.
//!
//! Regex compilation is expensive. By using `once_cell::sync::Lazy`, we compile
//! each pattern only once, on first use, and reuse it thereafter.

use once_cell::sync::Lazy;
use regex::Regex;

/// Regex for parsing timestamps in transcript text.
/// Matches formats like "0:15", "1:30:45", "[0:15]", "[1:30:45]"
///
/// Pattern breakdown:
/// - `^\[?` - Start of line, optional opening bracket
/// - `(\d+:\d+(?::\d+)?)` - Capture group: digits:digits, optionally followed by :digits
/// - `\]?\s*$` - Optional closing bracket, optional whitespace, end of line
pub static TIMESTAMP_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^\[?(\d+:\d+(?::\d+)?)\]?\s*$")
        .expect("Invalid timestamp regex pattern")
});

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timestamp_simple() {
        let caps = TIMESTAMP_REGEX.captures("0:15").unwrap();
        assert_eq!(caps.get(1).unwrap().as_str(), "0:15");
    }

    #[test]
    fn test_timestamp_with_brackets() {
        let caps = TIMESTAMP_REGEX.captures("[1:30]").unwrap();
        assert_eq!(caps.get(1).unwrap().as_str(), "1:30");
    }

    #[test]
    fn test_timestamp_with_hours() {
        let caps = TIMESTAMP_REGEX.captures("1:30:45").unwrap();
        assert_eq!(caps.get(1).unwrap().as_str(), "1:30:45");
    }

    #[test]
    fn test_timestamp_with_brackets_and_hours() {
        let caps = TIMESTAMP_REGEX.captures("[1:30:45]").unwrap();
        assert_eq!(caps.get(1).unwrap().as_str(), "1:30:45");
    }

    #[test]
    fn test_timestamp_with_trailing_whitespace() {
        let caps = TIMESTAMP_REGEX.captures("[0:15]  ").unwrap();
        assert_eq!(caps.get(1).unwrap().as_str(), "0:15");
    }

    #[test]
    fn test_no_match_for_text() {
        assert!(TIMESTAMP_REGEX.captures("Hello world").is_none());
    }

    #[test]
    fn test_no_match_for_partial() {
        assert!(TIMESTAMP_REGEX.captures("[0:15] Some text").is_none());
    }
}
