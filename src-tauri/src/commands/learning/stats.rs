//! Learning statistics and SRS analytics.
//!
//! This module provides statistics about learning progress,
//! including phrase counts by status and SRS review distribution.

use crate::db::get_conn;
use crate::models::{IntervalDistribution, LearningStats, SrsStats};
use rusqlite::params;

/// Get general learning statistics.
///
/// Returns counts of total, learned, learning, and new phrases,
/// along with average success rate and total practice sessions.
#[tauri::command]
pub fn get_learning_stats(target_language: Option<String>) -> Result<LearningStats, String> {
    let conn = get_conn()?;

    // Use parameterized queries for language filter
    let (lang_filter, params): (&str, Vec<&dyn rusqlite::ToSql>) = match &target_language {
        Some(lang) => (
            " AND p.target_language = ?",
            vec![lang as &dyn rusqlite::ToSql],
        ),
        None => ("", vec![]),
    };

    // Total phrases
    let total_phrases: i32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM phrases p WHERE 1=1{}",
                lang_filter
            ),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Learned (streak >= required_streak, default 2)
    let learned_count: i32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM phrases p
                 JOIN phrase_progress pp ON p.id = pp.phrase_id
                 WHERE pp.correct_streak >= 2{}",
                lang_filter
            ),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Learning (has progress but streak < required)
    let learning_count: i32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM phrases p
                 JOIN phrase_progress pp ON p.id = pp.phrase_id
                 WHERE pp.correct_streak < 2 AND pp.total_attempts > 0{}",
                lang_filter
            ),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0);

    // New (no progress)
    let new_count = total_phrases - learned_count - learning_count;

    // Average success rate
    let average_success_rate: f64 = conn
        .query_row(
            &format!(
                "SELECT COALESCE(AVG(CAST(pp.success_count AS REAL) / NULLIF(pp.total_attempts, 0)), 0)
                 FROM phrases p
                 JOIN phrase_progress pp ON p.id = pp.phrase_id
                 WHERE 1=1{}",
                lang_filter
            ),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Total sessions
    let total_sessions: i32 = conn
        .query_row("SELECT COUNT(*) FROM practice_sessions", [], |row| {
            row.get(0)
        })
        .unwrap_or(0);

    // Phrases in decks (have deck_id, not yet graduated to SRS)
    let in_decks_count: i32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM phrases p
                 LEFT JOIN phrase_progress pp ON p.id = pp.phrase_id
                 WHERE p.deck_id IS NOT NULL
                 AND (pp.in_srs_pool = 0 OR pp.in_srs_pool IS NULL){}",
                lang_filter
            ),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Phrases graduated to SRS (in_srs_pool = 1)
    let graduated_to_srs_count: i32 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM phrases p
                 JOIN phrase_progress pp ON p.id = pp.phrase_id
                 WHERE pp.in_srs_pool = 1{}",
                lang_filter
            ),
            params.as_slice(),
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(LearningStats {
        total_phrases,
        learned_count,
        learning_count,
        new_count,
        average_success_rate,
        total_sessions,
        in_decks_count,
        graduated_to_srs_count,
    })
}

/// Get detailed SRS statistics.
///
/// Returns review counts by time period (due now, today, tomorrow, this week)
/// and interval distribution statistics.
#[tauri::command]
pub fn get_srs_stats(target_language: Option<String>) -> Result<SrsStats, String> {
    let conn = get_conn()?;
    let now = chrono::Utc::now().naive_utc();
    let today_end = now.date().and_hms_opt(23, 59, 59).unwrap();
    let tomorrow_end = today_end + chrono::Duration::days(1);
    let week_end = today_end + chrono::Duration::days(7);

    let now_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
    let today_str = today_end.format("%Y-%m-%d %H:%M:%S").to_string();
    let tomorrow_str = tomorrow_end.format("%Y-%m-%d %H:%M:%S").to_string();
    let week_str = week_end.format("%Y-%m-%d %H:%M:%S").to_string();

    // Build language filter clause
    // All SRS stats filter by in_srs_pool = 1 to only count graduated phrases
    let (lang_join, lang_filter) = match &target_language {
        Some(_) => (
            "INNER JOIN phrases p ON pp.phrase_id = p.id",
            "AND p.target_language = ?",
        ),
        None => ("", ""),
    };

    // Due now (overdue) - only phrases in SRS pool
    let overdue: i32 = query_srs_count(
        &conn,
        &format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE pp.in_srs_pool = 1 AND pp.next_review_at < ?1 {}",
            lang_join, lang_filter
        ),
        "SELECT COUNT(*) FROM phrase_progress WHERE in_srs_pool = 1 AND next_review_at < ?1",
        &target_language,
        &[&now_str as &dyn rusqlite::ToSql],
    );

    // Due today (including overdue) - only phrases in SRS pool
    let due_today: i32 = query_srs_count(
        &conn,
        &format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE pp.in_srs_pool = 1 AND pp.next_review_at <= ?1 {}",
            lang_join, lang_filter
        ),
        "SELECT COUNT(*) FROM phrase_progress WHERE in_srs_pool = 1 AND next_review_at <= ?1",
        &target_language,
        &[&today_str as &dyn rusqlite::ToSql],
    );

    // Due tomorrow - only phrases in SRS pool
    let due_tomorrow: i32 = query_srs_count_range(
        &conn,
        &format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE pp.in_srs_pool = 1 AND pp.next_review_at > ?1 AND pp.next_review_at <= ?2 {}",
            lang_join, lang_filter
        ),
        "SELECT COUNT(*) FROM phrase_progress WHERE in_srs_pool = 1 AND next_review_at > ?1 AND next_review_at <= ?2",
        &target_language,
        &today_str,
        &tomorrow_str,
    );

    // Due this week - only phrases in SRS pool
    let due_this_week: i32 = query_srs_count_range(
        &conn,
        &format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE pp.in_srs_pool = 1 AND pp.next_review_at > ?1 AND pp.next_review_at <= ?2 {}",
            lang_join, lang_filter
        ),
        "SELECT COUNT(*) FROM phrase_progress WHERE in_srs_pool = 1 AND next_review_at > ?1 AND next_review_at <= ?2",
        &target_language,
        &today_str,
        &week_str,
    );

    // Total phrases with reviews scheduled - only phrases in SRS pool
    let total_reviews: i32 = query_srs_count_no_date(
        &conn,
        &format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE pp.in_srs_pool = 1 AND pp.next_review_at IS NOT NULL {}",
            lang_join,
            if target_language.is_some() {
                "AND p.target_language = ?1"
            } else {
                ""
            }
        ),
        "SELECT COUNT(*) FROM phrase_progress WHERE in_srs_pool = 1 AND next_review_at IS NOT NULL",
        &target_language,
    );

    // Average ease factor - only phrases in SRS pool
    let average_ease_factor: f64 = query_srs_avg(
        &conn,
        &format!(
            "SELECT COALESCE(AVG(pp.ease_factor), 2.5) FROM phrase_progress pp {} WHERE pp.in_srs_pool = 1 {}",
            lang_join,
            if target_language.is_some() {
                "AND p.target_language = ?1"
            } else {
                ""
            }
        ),
        "SELECT COALESCE(AVG(ease_factor), 2.5) FROM phrase_progress WHERE in_srs_pool = 1",
        &target_language,
    );

    // Interval distribution - only phrases in SRS pool
    let interval_distribution = get_interval_distribution(&conn, lang_join, &target_language);

    Ok(SrsStats {
        due_now: overdue,
        overdue,
        due_today,
        due_tomorrow,
        due_this_week,
        total_reviews,
        average_ease_factor,
        interval_distribution,
    })
}

/// Helper to query SRS count with single date parameter.
fn query_srs_count(
    conn: &rusqlite::Connection,
    query_with_lang: &str,
    query_no_lang: &str,
    target_language: &Option<String>,
    date_params: &[&dyn rusqlite::ToSql],
) -> i32 {
    match target_language {
        Some(lang) => {
            let mut params: Vec<&dyn rusqlite::ToSql> = date_params.to_vec();
            params.push(lang);
            conn.query_row(query_with_lang, params.as_slice(), |row| row.get(0))
                .unwrap_or(0)
        }
        None => conn
            .query_row(query_no_lang, date_params, |row| row.get(0))
            .unwrap_or(0),
    }
}

/// Helper to query SRS count with date range.
fn query_srs_count_range(
    conn: &rusqlite::Connection,
    query_with_lang: &str,
    query_no_lang: &str,
    target_language: &Option<String>,
    start_date: &str,
    end_date: &str,
) -> i32 {
    match target_language {
        Some(lang) => conn
            .query_row(
                query_with_lang,
                params![start_date, end_date, lang],
                |row| row.get(0),
            )
            .unwrap_or(0),
        None => conn
            .query_row(query_no_lang, params![start_date, end_date], |row| {
                row.get(0)
            })
            .unwrap_or(0),
    }
}

/// Helper to query SRS count without date parameter.
fn query_srs_count_no_date(
    conn: &rusqlite::Connection,
    query_with_lang: &str,
    query_no_lang: &str,
    target_language: &Option<String>,
) -> i32 {
    match target_language {
        Some(lang) => conn
            .query_row(query_with_lang, params![lang], |row| row.get(0))
            .unwrap_or(0),
        None => conn
            .query_row(query_no_lang, [], |row| row.get(0))
            .unwrap_or(0),
    }
}

/// Helper to query SRS average.
fn query_srs_avg(
    conn: &rusqlite::Connection,
    query_with_lang: &str,
    query_no_lang: &str,
    target_language: &Option<String>,
) -> f64 {
    match target_language {
        Some(lang) => conn
            .query_row(query_with_lang, params![lang], |row| row.get(0))
            .unwrap_or(2.5),
        None => conn
            .query_row(query_no_lang, [], |row| row.get(0))
            .unwrap_or(2.5),
    }
}

/// Get interval distribution statistics (only for phrases in SRS pool).
fn get_interval_distribution(
    conn: &rusqlite::Connection,
    lang_join: &str,
    target_language: &Option<String>,
) -> IntervalDistribution {
    let interval_count = |condition: &str| -> i32 {
        let query = format!(
            "SELECT COUNT(*) FROM phrase_progress pp {} WHERE pp.in_srs_pool = 1 AND {} {}",
            lang_join,
            condition,
            if target_language.is_some() {
                "AND p.target_language = ?1"
            } else {
                ""
            }
        );
        match target_language {
            Some(lang) => conn
                .query_row(&query, params![lang], |row| row.get(0))
                .unwrap_or(0),
            None => {
                let simple_query = format!(
                    "SELECT COUNT(*) FROM phrase_progress WHERE in_srs_pool = 1 AND {}",
                    condition
                );
                conn.query_row(&simple_query, [], |row| row.get(0))
                    .unwrap_or(0)
            }
        }
    };

    IntervalDistribution {
        one_day: interval_count("pp.interval_days = 1"),
        two_to_three_days: interval_count("pp.interval_days >= 2 AND pp.interval_days <= 3"),
        four_to_seven_days: interval_count("pp.interval_days >= 4 AND pp.interval_days <= 7"),
        one_to_two_weeks: interval_count("pp.interval_days >= 8 AND pp.interval_days <= 14"),
        two_weeks_plus: interval_count("pp.interval_days > 14"),
    }
}

/// Reset all practice sessions (clears session history).
#[tauri::command]
pub fn reset_practice_sessions() -> Result<i32, String> {
    let conn = get_conn()?;
    let deleted = conn
        .execute("DELETE FROM practice_sessions", [])
        .map_err(|e| format!("Failed to delete sessions: {}", e))?;
    Ok(deleted as i32)
}

/// Reset all phrase progress (clears learning history, keeps phrases).
#[tauri::command]
pub fn reset_phrase_progress() -> Result<i32, String> {
    let conn = get_conn()?;
    let updated = conn
        .execute(
            "UPDATE phrase_progress SET
                correct_streak = 0,
                total_attempts = 0,
                success_count = 0,
                last_seen = NULL,
                ease_factor = 2.5,
                interval_days = 0,
                next_review_at = NULL,
                in_srs_pool = 0,
                deck_correct_count = 0,
                learning_status = 'new'",
            [],
        )
        .map_err(|e| format!("Failed to reset progress: {}", e))?;
    Ok(updated as i32)
}
