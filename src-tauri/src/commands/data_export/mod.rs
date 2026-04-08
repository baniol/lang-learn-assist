mod duplicates;
mod export;
mod import;

pub use duplicates::*;
pub use export::*;
pub use import::*;

#[cfg(test)]
mod tests {
    use crate::commands::data_export::export::export_data_with_conn;
    use crate::commands::data_export::import::import_data_with_conn;
    use crate::db::init_db;
    use crate::models::{ExportData, ExportPhrase, ExportSetting, ImportMode};
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory database");
        init_db(&conn).expect("Failed to initialize database schema");
        conn
    }

    fn create_test_export_data() -> ExportData {
        ExportData {
            version: 5,
            exported_at: "2024-01-01T00:00:00Z".to_string(),
            settings: vec![ExportSetting {
                key: "test_key".to_string(),
                value: "test_value".to_string(),
            }],
            phrases: vec![ExportPhrase {
                id: 1,
                conversation_id: None,
                material_id: None,
                deck_id: None,
                prompt: "Hello".to_string(),
                answer: "Hallo".to_string(),
                accepted_json: "[]".to_string(),
                target_language: "de".to_string(),
                native_language: "en".to_string(),
                audio_path: None,
                notes: None,
                starred: false,
                excluded: None,
                created_at: "2024-01-01T00:00:00Z".to_string(),
            }],
            phrase_threads: vec![],
            question_threads: vec![],
            notes: vec![],
            materials: vec![],
            material_threads: vec![],
            practice_sessions: vec![],
            tags: vec![],
            phrase_tags: vec![],
            exercise_sessions: vec![],
            exercise_session_phrases: vec![],
            phrase_progress: vec![],
            decks: vec![],
        }
    }

    #[test]
    fn test_export_empty_database() {
        let conn = setup_test_db();
        let result = export_data_with_conn(&conn);
        assert!(result.is_ok());

        let data = result.unwrap();
        assert_eq!(data.version, 5);
        assert!(data.settings.is_empty());
        assert!(data.phrases.is_empty());
    }

    #[test]
    fn test_import_overwrite_mode() {
        let mut conn = setup_test_db();

        let test_data = create_test_export_data();
        let result = import_data_with_conn(&mut conn, test_data, ImportMode::Overwrite);

        assert!(result.is_ok());
        let import_result = result.unwrap();
        assert!(import_result.success);
        assert_eq!(import_result.stats.settings_imported, 1);
        assert_eq!(import_result.stats.phrases_imported, 1);
    }

    #[test]
    fn test_import_then_export_roundtrip() {
        let mut conn = setup_test_db();

        let original_data = create_test_export_data();
        import_data_with_conn(&mut conn, original_data.clone(), ImportMode::Overwrite)
            .expect("Import failed");

        let exported = export_data_with_conn(&conn).expect("Export failed");

        assert_eq!(exported.settings.len(), 1);
        assert_eq!(exported.settings[0].key, "test_key");
        assert_eq!(exported.phrases.len(), 1);
        assert_eq!(exported.phrases[0].prompt, "Hello");
        assert_eq!(exported.phrases[0].answer, "Hallo");
    }

    #[test]
    fn test_import_merge_mode_adds_new() {
        let mut conn = setup_test_db();

        let data1 = create_test_export_data();
        import_data_with_conn(&mut conn, data1, ImportMode::Overwrite)
            .expect("First import failed");

        let mut data2 = create_test_export_data();
        data2.phrases[0].id = 2;
        data2.phrases[0].prompt = "Goodbye".to_string();
        data2.phrases[0].answer = "Tschüss".to_string();
        data2.phrases[0].created_at = "2024-01-02T00:00:00Z".to_string();
        let result = import_data_with_conn(&mut conn, data2, ImportMode::Merge);
        assert!(result.is_ok());

        let exported = export_data_with_conn(&conn).expect("Export failed");
        assert_eq!(exported.phrases.len(), 2);
    }

    #[test]
    fn test_import_merge_mode_skips_duplicates() {
        let mut conn = setup_test_db();

        let data = create_test_export_data();
        import_data_with_conn(&mut conn, data.clone(), ImportMode::Overwrite)
            .expect("First import failed");

        let result = import_data_with_conn(&mut conn, data.clone(), ImportMode::Merge);
        assert!(result.is_ok());
        let import_result = result.unwrap();

        assert_eq!(import_result.stats.phrases_imported, 0);
        let exported = export_data_with_conn(&conn).expect("Export failed");
        assert_eq!(exported.phrases.len(), 1);
    }

    #[test]
    fn test_import_rejects_future_version() {
        let mut conn = setup_test_db();

        let mut data = create_test_export_data();
        data.version = 99;

        let result = import_data_with_conn(&mut conn, data, ImportMode::Overwrite);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not supported"));
    }

    #[test]
    fn test_export_includes_all_phrase_fields() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO phrases (id, prompt, answer, accepted_json,
                                  target_language, native_language, audio_path, notes,
                                  starred, created_at)
             VALUES (1, 'Hello', 'Hallo', '[\"Hi\"]', 'de', 'en', '/path/to/audio.mp3',
                     'A greeting', 1, '2024-01-01')",
            [],
        )
        .unwrap();

        let exported = export_data_with_conn(&conn).expect("Export failed");
        let phrase = &exported.phrases[0];

        assert_eq!(phrase.prompt, "Hello");
        assert_eq!(phrase.answer, "Hallo");
        assert_eq!(phrase.accepted_json, "[\"Hi\"]");
        assert_eq!(phrase.audio_path, Some("/path/to/audio.mp3".to_string()));
        assert_eq!(phrase.notes, Some("A greeting".to_string()));
        assert!(phrase.starred);
    }
}
