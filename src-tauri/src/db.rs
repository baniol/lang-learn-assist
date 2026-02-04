use rusqlite::{Connection, Result};
use std::path::PathBuf;

/// Log a migration result, reporting any errors while allowing continuation.
/// This is used for migrations that may fail on existing databases
/// (e.g., adding a column that already exists).
fn log_migration_result(migration_name: &str, result: std::result::Result<usize, rusqlite::Error>) {
    if let Err(e) = result {
        // Check if it's a "duplicate column" error which is expected for existing DBs
        let error_str = e.to_string();
        if error_str.contains("duplicate column") || error_str.contains("already exists") {
            // Expected error - column already exists from previous migration
        } else {
            eprintln!("Warning: Migration '{}' failed: {}", migration_name, e);
        }
    }
}

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
        log_migration_result(
            "add ease_factor to phrase_progress",
            conn.execute(
                "ALTER TABLE phrase_progress ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5",
                [],
            ),
        );
    }
    if !columns.contains(&"interval_days".to_string()) {
        log_migration_result(
            "add interval_days to phrase_progress",
            conn.execute(
                "ALTER TABLE phrase_progress ADD COLUMN interval_days INTEGER NOT NULL DEFAULT 1",
                [],
            ),
        );
    }
    if !columns.contains(&"next_review_at".to_string()) {
        log_migration_result(
            "add next_review_at to phrase_progress",
            conn.execute("ALTER TABLE phrase_progress ADD COLUMN next_review_at TEXT", []),
        );
    }

    // Migration: Add excluded column to phrases if it doesn't exist
    let phrase_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(phrases)")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
        })
        .unwrap_or_default();

    if !phrase_columns.contains(&"excluded".to_string()) {
        log_migration_result(
            "add excluded to phrases",
            conn.execute(
                "ALTER TABLE phrases ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0",
                [],
            ),
        );
    }

    // Migration: Add material_id column to phrases if it doesn't exist
    if !phrase_columns.contains(&"material_id".to_string()) {
        log_migration_result(
            "add material_id to phrases",
            conn.execute(
                "ALTER TABLE phrases ADD COLUMN material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL",
                [],
            ),
        );
    }

    // Practice sessions table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS practice_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT NOT NULL DEFAULT (datetime('now')),
            finished_at TEXT,
            total_phrases INTEGER NOT NULL DEFAULT 0,
            correct_answers INTEGER NOT NULL DEFAULT 0,
            exercise_mode TEXT NOT NULL DEFAULT 'speaking',
            state_json TEXT
        )",
        [],
    )?;

    // Migration: Add state_json column to practice_sessions if it doesn't exist
    let session_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(practice_sessions)")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
        })
        .unwrap_or_default();

    if !session_columns.contains(&"state_json".to_string()) {
        log_migration_result(
            "add state_json to practice_sessions",
            conn.execute("ALTER TABLE practice_sessions ADD COLUMN state_json TEXT", []),
        );
    }

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

    // Question threads table for grammar/style Q&A
    conn.execute(
        "CREATE TABLE IF NOT EXISTS question_threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            target_language TEXT NOT NULL DEFAULT 'de',
            native_language TEXT NOT NULL DEFAULT 'pl',
            messages_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    // Notes table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    // Materials table (for YouTube transcripts, articles, etc.)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            material_type TEXT NOT NULL,
            source_url TEXT,
            original_text TEXT NOT NULL,
            segments_json TEXT,
            target_language TEXT NOT NULL DEFAULT 'de',
            native_language TEXT NOT NULL DEFAULT 'pl',
            status TEXT NOT NULL DEFAULT 'pending',
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
    // Material threads table (for sentence Q&A)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS material_threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
            segment_index INTEGER NOT NULL,
            messages_json TEXT NOT NULL DEFAULT '[]',
            suggested_phrases_json TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_material_threads_material ON material_threads(material_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(material_type)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_phrases_material ON phrases(material_id)",
        [],
    )?;

    // Migration: Add processed_chunks column to materials if it doesn't exist
    let material_columns: Vec<String> = conn
        .prepare("PRAGMA table_info(materials)")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
        })
        .unwrap_or_default();

    if !material_columns.contains(&"processed_chunks".to_string()) {
        log_migration_result(
            "add processed_chunks to materials",
            conn.execute(
                "ALTER TABLE materials ADD COLUMN processed_chunks INTEGER NOT NULL DEFAULT 0",
                [],
            ),
        );
    }

    Ok(())
}
