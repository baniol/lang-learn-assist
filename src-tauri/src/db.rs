use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn get_db_path() -> PathBuf {
    let app_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.marcinbaniowski.lang-learn-assist");

    std::fs::create_dir_all(&app_dir).ok();
    app_dir.join("data.db")
}

/// Get a database connection with foreign keys enabled.
/// This is the standard way to get a connection across all command modules.
pub fn get_conn() -> std::result::Result<Connection, String> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;
    Ok(conn)
}

pub fn get_audio_dir() -> PathBuf {
    let app_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.marcinbaniowski.lang-learn-assist")
        .join("audio");

    std::fs::create_dir_all(&app_dir).ok();
    app_dir
}

pub fn init_db(conn: &Connection) -> Result<()> {
    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])?;

    // Settings table (key-value store)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Conversations table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            subject TEXT NOT NULL,
            target_language TEXT NOT NULL DEFAULT 'de',
            native_language TEXT NOT NULL DEFAULT 'pl',
            status TEXT NOT NULL DEFAULT 'draft',
            raw_messages_json TEXT NOT NULL DEFAULT '[]',
            final_messages_json TEXT,
            llm_summary TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    // Phrases table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS phrases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER,
            prompt TEXT NOT NULL,
            answer TEXT NOT NULL,
            accepted_json TEXT NOT NULL DEFAULT '[]',
            target_language TEXT NOT NULL DEFAULT 'de',
            native_language TEXT NOT NULL DEFAULT 'pl',
            audio_path TEXT,
            notes TEXT,
            starred INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
        )",
        [],
    )?;

    // Phrase progress table with SRS fields
    conn.execute(
        "CREATE TABLE IF NOT EXISTS phrase_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phrase_id INTEGER NOT NULL UNIQUE,
            correct_streak INTEGER NOT NULL DEFAULT 0,
            total_attempts INTEGER NOT NULL DEFAULT 0,
            success_count INTEGER NOT NULL DEFAULT 0,
            last_seen TEXT,
            ease_factor REAL NOT NULL DEFAULT 2.5,
            interval_days INTEGER NOT NULL DEFAULT 1,
            next_review_at TEXT,
            FOREIGN KEY (phrase_id) REFERENCES phrases(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Migration: Add SRS columns if they don't exist (for existing databases)
    let columns: Vec<String> = conn
        .prepare("PRAGMA table_info(phrase_progress)")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
        })
        .unwrap_or_default();

    if !columns.contains(&"ease_factor".to_string()) {
        conn.execute(
            "ALTER TABLE phrase_progress ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5",
            [],
        ).ok();
    }
    if !columns.contains(&"interval_days".to_string()) {
        conn.execute(
            "ALTER TABLE phrase_progress ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 1",
            [],
        ).ok();
    }
    if !columns.contains(&"next_review_at".to_string()) {
        conn.execute(
            "ALTER TABLE phrase_progress ADD COLUMN next_review_at TEXT",
            [],
        ).ok();
    }

    // Practice sessions table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS practice_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT NOT NULL DEFAULT (datetime('now')),
            finished_at TEXT,
            total_phrases INTEGER NOT NULL DEFAULT 0,
            correct_answers INTEGER NOT NULL DEFAULT 0,
            exercise_mode TEXT NOT NULL DEFAULT 'speaking'
        )",
        [],
    )?;

    // Phrase refinement threads table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS phrase_threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phrase_id INTEGER NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
            messages_json TEXT NOT NULL DEFAULT '[]',
            suggested_prompt TEXT,
            suggested_answer TEXT,
            suggested_accepted TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    // Create indexes for performance
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_phrases_conversation ON phrases(conversation_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_phrases_starred ON phrases(starred)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_phrase_progress_phrase ON phrase_progress(phrase_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_phrase_threads_phrase ON phrase_threads(phrase_id)",
        [],
    )?;

    Ok(())
}
