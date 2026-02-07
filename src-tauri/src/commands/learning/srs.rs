//! SRS (Spaced Repetition System) algorithm implementation.
//!
//! This module contains the core SRS logic for calculating review priorities
//! and scheduling next review dates using a simplified SM-2 algorithm.

use crate::constants::priority::{DUE_FOR_REVIEW_BASE, LEARNING_PHASE, NEW_PHRASE, NOT_DUE, PARSE_ERROR};
use crate::constants::srs::{
    EASE_PENALTY, INCORRECT_REVIEW_MINUTES, LEARNING_GRADUATION_STREAK, LEARNING_REVIEW_MINUTES,
    MIN_EASE_FACTOR,
};
use crate::models::PhraseProgress;

/// Calculate priority for SRS-based scheduling.
///
/// Higher priority = should be shown sooner.
///
/// Priority levels:
/// - Due for review (next_review_at <= now): 2000 + overdue_hours (most urgent first)
/// - New phrases (no progress): 1000
/// - Learning phase (interval_days = 0, not yet due): 800 (always available in session)
/// - Not yet due (graduated phrases): 0 (skip these)
pub fn calculate_priority(progress: &Option<PhraseProgress>) -> f64 {
    match progress {
        None => NEW_PHRASE, // New phrases get high priority
        Some(p) => {
            if p.total_attempts == 0 {
                return NEW_PHRASE; // Never practiced = treat as new
            }

            // Check if due for review based on next_review_at
            match &p.next_review_at {
                Some(next_review) => {
                    match chrono::NaiveDateTime::parse_from_str(next_review, "%Y-%m-%d %H:%M:%S") {
                        Ok(review_dt) => {
                            let now = chrono::Utc::now().naive_utc();
                            if review_dt <= now {
                                // Due or overdue - higher priority for more overdue
                                let overdue_hours =
                                    now.signed_duration_since(review_dt).num_hours() as f64;
                                DUE_FOR_REVIEW_BASE + overdue_hours
                            } else {
                                // Not yet due - check if in learning phase
                                // Learning-phase phrases (interval_days = 0) should always
                                // be available within a session for repetition
                                if p.interval_days == 0 {
                                    LEARNING_PHASE
                                } else {
                                    // Graduated phrases not yet due - skip
                                    NOT_DUE
                                }
                            }
                        }
                        Err(_) => PARSE_ERROR, // Parse error - medium priority
                    }
                }
                None => PARSE_ERROR, // No next_review_at set - medium priority (legacy data)
            }
        }
    }
}

/// Calculate next review date using simplified SM-2 algorithm.
///
/// For learning phase (interval_days == 0), use short intervals (minutes).
/// For review phase (interval_days >= 1), use SRS with days.
///
/// Returns (new_ease_factor, new_interval_days, next_review_at_string).
pub fn calculate_next_review(
    is_correct: bool,
    current_ease: f64,
    current_interval: i32,
    correct_streak: i32,
) -> (f64, i32, String) {
    let now = chrono::Utc::now();

    // Learning phase: streak < LEARNING_GRADUATION_STREAK, use short intervals
    let is_learning = correct_streak < LEARNING_GRADUATION_STREAK;

    if is_correct {
        if is_learning {
            // Still learning - keep interval at 0 (same session) until streak reaches graduation
            // Then graduate to 1 day
            let new_interval = if correct_streak + 1 >= LEARNING_GRADUATION_STREAK {
                1
            } else {
                0
            };
            let next_review = if new_interval == 0 {
                now + chrono::Duration::minutes(LEARNING_REVIEW_MINUTES) // Review again soon
            } else {
                now + chrono::Duration::days(1) // Graduate to 1 day
            };
            let next_review_str = next_review.format("%Y-%m-%d %H:%M:%S").to_string();
            (current_ease, new_interval, next_review_str)
        } else {
            // Review phase: multiply interval by ease factor
            let new_interval = ((current_interval as f64) * current_ease).round() as i32;
            // Ensure interval increases by at least 1 day
            let new_interval = new_interval.max(current_interval + 1);
            let next_review = now + chrono::Duration::days(new_interval as i64);
            let next_review_str = next_review.format("%Y-%m-%d %H:%M:%S").to_string();
            (current_ease, new_interval, next_review_str)
        }
    } else {
        // Incorrect answer: soft reset
        let new_ease = (current_ease - EASE_PENALTY).max(MIN_EASE_FACTOR);

        if current_interval >= 1 {
            // Review phase: halve interval instead of full reset (minimum 1 day)
            let new_interval = (current_interval / 2).max(1);
            let next_review = now + chrono::Duration::days(new_interval as i64);
            let next_review_str = next_review.format("%Y-%m-%d %H:%M:%S").to_string();
            (new_ease, new_interval, next_review_str)
        } else {
            // Learning phase: still use short intervals
            let next_review = now + chrono::Duration::minutes(INCORRECT_REVIEW_MINUTES);
            let next_review_str = next_review.format("%Y-%m-%d %H:%M:%S").to_string();
            (new_ease, 0, next_review_str)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::LearningStatus;

    #[test]
    fn test_calculate_priority_new_phrase() {
        let priority = calculate_priority(&None);
        assert_eq!(priority, NEW_PHRASE);
    }

    #[test]
    fn test_calculate_priority_never_practiced() {
        let progress = Some(PhraseProgress {
            id: 1,
            phrase_id: 1,
            correct_streak: 0,
            total_attempts: 0,
            success_count: 0,
            last_seen: None,
            ease_factor: 2.5,
            interval_days: 0,
            next_review_at: None,
            in_srs_pool: true,
            deck_correct_count: 0,
            learning_status: LearningStatus::SrsActive,
        });
        let priority = calculate_priority(&progress);
        assert_eq!(priority, NEW_PHRASE);
    }

    #[test]
    fn test_calculate_next_review_correct_learning() {
        let (ease, interval, _) = calculate_next_review(true, 2.5, 0, 0);
        assert_eq!(ease, 2.5);
        assert_eq!(interval, 0); // Still in learning phase
    }

    #[test]
    fn test_calculate_next_review_graduation() {
        let (ease, interval, _) = calculate_next_review(true, 2.5, 0, 1);
        assert_eq!(ease, 2.5);
        assert_eq!(interval, 1); // Graduated to review phase
    }

    #[test]
    fn test_calculate_next_review_incorrect_review_phase() {
        // Review phase (interval >= 1): soft reset - halve interval
        let (ease, interval, _) = calculate_next_review(false, 2.5, 8, 2);
        assert!((ease - 2.3).abs() < 0.01);
        assert_eq!(interval, 4); // Halved from 8 to 4

        let (ease, interval, _) = calculate_next_review(false, 2.5, 3, 2);
        assert!((ease - 2.3).abs() < 0.01);
        assert_eq!(interval, 1); // Halved from 3 to 1 (minimum)

        let (ease, interval, _) = calculate_next_review(false, 2.5, 1, 2);
        assert!((ease - 2.3).abs() < 0.01);
        assert_eq!(interval, 1); // Already at minimum, stays at 1
    }

    #[test]
    fn test_calculate_next_review_incorrect_learning_phase() {
        // Learning phase (interval 0): still use short intervals
        let (ease, interval, _) = calculate_next_review(false, 2.5, 0, 0);
        assert!((ease - 2.3).abs() < 0.01);
        assert_eq!(interval, 0); // Stays in learning phase
    }

    #[test]
    fn test_calculate_priority_learning_phase_not_yet_due() {
        // Learning-phase phrase (interval_days = 0) that's scheduled for the future
        // should still get LEARNING_PHASE priority so it's available in the session
        let future_time = chrono::Utc::now() + chrono::Duration::minutes(10);
        let progress = Some(PhraseProgress {
            id: 1,
            phrase_id: 1,
            correct_streak: 1,
            total_attempts: 1,
            success_count: 1,
            last_seen: Some("2024-01-01 00:00:00".to_string()),
            ease_factor: 2.5,
            interval_days: 0, // Still in learning phase
            next_review_at: Some(future_time.format("%Y-%m-%d %H:%M:%S").to_string()),
            in_srs_pool: true,
            deck_correct_count: 0,
            learning_status: LearningStatus::SrsActive,
        });
        let priority = calculate_priority(&progress);
        assert_eq!(priority, LEARNING_PHASE);
    }

    #[test]
    fn test_calculate_priority_graduated_not_yet_due() {
        // Graduated phrase (interval_days >= 1) that's not yet due
        // should get NOT_DUE priority
        let future_time = chrono::Utc::now() + chrono::Duration::days(1);
        let progress = Some(PhraseProgress {
            id: 1,
            phrase_id: 1,
            correct_streak: 2,
            total_attempts: 2,
            success_count: 2,
            last_seen: Some("2024-01-01 00:00:00".to_string()),
            ease_factor: 2.5,
            interval_days: 1, // Graduated
            next_review_at: Some(future_time.format("%Y-%m-%d %H:%M:%S").to_string()),
            in_srs_pool: true,
            deck_correct_count: 0,
            learning_status: LearningStatus::SrsActive,
        });
        let priority = calculate_priority(&progress);
        assert_eq!(priority, NOT_DUE);
    }
}
