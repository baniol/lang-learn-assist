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

    // Phrases table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS phrases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt TEXT NOT NULL,
            answer TEXT NOT NULL,
            accepted_json TEXT NOT NULL DEFAULT '[]',
            target_language TEXT NOT NULL DEFAULT 'de',
            native_language TEXT NOT NULL DEFAULT 'pl',
            audio_path TEXT,
            notes TEXT,
            starred INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

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

    // Migration: Add refined column to phrases
    if !phrase_columns.contains(&"refined".to_string()) {
        log_migration_result(
            "add refined to phrases",
            conn.execute(
                "ALTER TABLE phrases ADD COLUMN refined INTEGER NOT NULL DEFAULT 0",
                [],
            ),
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
        "CREATE INDEX IF NOT EXISTS idx_phrases_starred ON phrases(starred)",
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

    if !material_columns.contains(&"bookmark_index".to_string()) {
        log_migration_result(
            "add bookmark_index to materials",
            conn.execute(
                "ALTER TABLE materials ADD COLUMN bookmark_index INTEGER",
                [],
            ),
        );
    }

    // Migration: Remove conversation_id column and any FK constraint on it
    let phrase_columns_updated: Vec<String> = conn
        .prepare("PRAGMA table_info(phrases)")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
        })
        .unwrap_or_default();

    let has_conversation_id = phrase_columns_updated.contains(&"conversation_id".to_string());
    let has_deck_id = phrase_columns_updated.contains(&"deck_id".to_string());

    // Rebuild phrases table if it has conversation_id or deck_id columns
    if has_conversation_id || has_deck_id {
        // Disable FK checks for the migration
        let _ = conn.execute("PRAGMA foreign_keys = OFF", []);

        // Rebuild phrases table without conversation_id and deck_id columns
        log_migration_result(
            "create phrases_new without conversation_id/deck_id",
            conn.execute(
                "CREATE TABLE IF NOT EXISTS phrases_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    prompt TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    accepted_json TEXT NOT NULL DEFAULT '[]',
                    target_language TEXT NOT NULL DEFAULT 'de',
                    native_language TEXT NOT NULL DEFAULT 'pl',
                    audio_path TEXT,
                    notes TEXT,
                    starred INTEGER NOT NULL DEFAULT 0,
                    excluded INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
                    refined INTEGER NOT NULL DEFAULT 0
                )",
                [],
            ),
        );

        log_migration_result(
            "copy phrases to phrases_new",
            conn.execute(
                "INSERT INTO phrases_new (id, prompt, answer, accepted_json,
                    target_language, native_language, audio_path, notes, starred, excluded, created_at,
                    material_id, refined)
                 SELECT id, prompt, answer, accepted_json,
                    target_language, native_language, audio_path, notes, starred, excluded, created_at,
                    material_id, refined FROM phrases",
                [],
            ),
        );

        log_migration_result("drop old phrases table", conn.execute("DROP TABLE phrases", []));

        log_migration_result(
            "rename phrases_new to phrases",
            conn.execute("ALTER TABLE phrases_new RENAME TO phrases", []),
        );

        // Re-enable FK checks
        let _ = conn.execute("PRAGMA foreign_keys = ON", []);

        // Recreate indexes
        log_migration_result(
            "recreate idx_phrases_starred",
            conn.execute("CREATE INDEX IF NOT EXISTS idx_phrases_starred ON phrases(starred)", []),
        );
        log_migration_result(
            "recreate idx_phrases_material",
            conn.execute("CREATE INDEX IF NOT EXISTS idx_phrases_material ON phrases(material_id)", []),
        );
    }

    // Migration: Drop tables that are no longer needed
    let _ = conn.execute("PRAGMA foreign_keys = OFF", []);
    log_migration_result(
        "drop conversations table",
        conn.execute("DROP TABLE IF EXISTS conversations", []),
    );
    log_migration_result(
        "drop decks table",
        conn.execute("DROP TABLE IF EXISTS decks", []),
    );
    log_migration_result(
        "drop practice_sessions table",
        conn.execute("DROP TABLE IF EXISTS practice_sessions", []),
    );
    log_migration_result(
        "drop phrase_progress table",
        conn.execute("DROP TABLE IF EXISTS phrase_progress", []),
    );
    log_migration_result(
        "drop notes table",
        conn.execute("DROP TABLE IF EXISTS notes", []),
    );
    log_migration_result(
        "drop question_threads table",
        conn.execute("DROP TABLE IF EXISTS question_threads", []),
    );
    let _ = conn.execute("PRAGMA foreign_keys = ON", []);

    // Drop old indexes
    log_migration_result(
        "drop idx_conversations_status index",
        conn.execute("DROP INDEX IF EXISTS idx_conversations_status", []),
    );
    log_migration_result(
        "drop idx_phrases_conversation index",
        conn.execute("DROP INDEX IF EXISTS idx_phrases_conversation", []),
    );
    log_migration_result(
        "drop idx_phrases_deck index",
        conn.execute("DROP INDEX IF EXISTS idx_phrases_deck", []),
    );
    log_migration_result(
        "drop idx_phrase_progress_phrase index",
        conn.execute("DROP INDEX IF EXISTS idx_phrase_progress_phrase", []),
    );
    log_migration_result(
        "drop idx_phrase_progress_srs_pool index",
        conn.execute("DROP INDEX IF EXISTS idx_phrase_progress_srs_pool", []),
    );

    Ok(())
}
