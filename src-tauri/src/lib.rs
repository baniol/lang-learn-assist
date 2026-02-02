mod commands;
mod db;
mod models;
mod state;

use commands::{audio, conversations, learning, llm, notes, phrases, questions, settings, tts};
use db::{get_db_path, init_db};
use rusqlite::Connection;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).expect("Failed to open database");
    init_db(&conn).expect("Failed to initialize database");
    drop(conn);

    // Load initial settings
    let initial_settings = settings::load_initial_settings();
    let app_state = AppState::new(initial_settings);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_mic_recorder::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Settings
            settings::get_settings,
            settings::save_settings,
            // Conversations
            conversations::get_conversations,
            conversations::get_conversation,
            conversations::create_conversation,
            conversations::update_conversation_messages,
            conversations::update_conversation_title,
            conversations::finalize_conversation,
            conversations::archive_conversation,
            conversations::delete_conversation,
            // Phrases
            phrases::get_phrases,
            phrases::get_phrase,
            phrases::create_phrase,
            phrases::create_phrases_batch,
            phrases::update_phrase,
            phrases::toggle_starred,
            phrases::toggle_excluded,
            phrases::update_phrase_audio,
            phrases::delete_phrase,
            // Phrase threads
            phrases::get_phrase_thread,
            phrases::create_phrase_thread,
            phrases::update_phrase_thread,
            phrases::accept_phrase_thread,
            phrases::delete_phrase_thread,
            // Learning
            learning::get_next_phrase,
            learning::record_answer,
            learning::get_learning_stats,
            learning::get_srs_stats,
            learning::get_practice_sessions,
            learning::start_practice_session,
            learning::update_practice_session,
            learning::finish_practice_session,
            learning::save_session_state,
            learning::get_active_session,
            learning::reset_learning_phrases,
            learning::reset_progress,
            learning::validate_answer,
            // LLM
            llm::send_conversation_message,
            llm::suggest_conversation_cleanup,
            llm::extract_phrases_from_conversation,
            llm::test_llm_connection,
            llm::refine_phrase,
            llm::generate_title,
            // Audio
            audio::get_available_models,
            audio::get_model_status,
            audio::is_model_downloaded,
            audio::download_model,
            audio::delete_model,
            audio::init_whisper,
            audio::is_whisper_ready,
            audio::transcribe_audio,
            // TTS
            tts::get_available_voices,
            tts::generate_tts,
            tts::get_audio_base64,
            tts::test_tts_connection,
            tts::get_voice_for_language,
            // Questions
            questions::get_question_threads,
            questions::get_question_thread,
            questions::create_question_thread,
            questions::delete_question_thread,
            questions::update_question_thread_title,
            questions::ask_grammar_question,
            // Notes
            notes::get_notes,
            notes::get_note,
            notes::create_note,
            notes::update_note,
            notes::delete_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
