mod commands;
mod constants;
mod db;
mod models;
mod state;
mod utils;

use commands::{audio, conversations, data_export, decks, learning, llm, materials, notes, phrases, questions, settings, tts};
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
            learning::selection::get_next_phrase,
            learning::selection::get_next_deck_phrase,
            learning::selection::get_study_phrase,  // Unified command
            learning::answer::record_answer,
            learning::answer::record_deck_answer,
            learning::answer::record_study_answer,  // Unified command
            learning::answer::validate_answer,
            learning::stats::get_learning_stats,
            learning::stats::get_srs_stats,
            learning::session::get_practice_sessions,
            learning::session::start_practice_session,
            learning::session::start_deck_session,
            learning::session::update_practice_session,
            learning::session::finish_practice_session,
            learning::session::save_session_state,
            learning::session::get_active_session,
            learning::session::reset_learning_phrases,
            learning::session::reset_progress,
            // LLM
            llm::conversation::send_conversation_message,
            llm::conversation::suggest_conversation_cleanup,
            llm::conversation::extract_phrases_from_conversation,
            llm::conversation::test_llm_connection,
            llm::phrase::refine_phrase,
            llm::phrase::generate_title,
            llm::material::process_material,
            llm::material::estimate_material_tokens,
            llm::material::ask_about_sentence,
            // Materials
            materials::create_material,
            materials::get_materials,
            materials::get_material,
            materials::update_material,
            materials::delete_material,
            materials::update_material_bookmark,
            materials::get_material_thread,
            materials::create_material_thread,
            materials::update_material_thread,
            materials::delete_material_thread,
            materials::get_material_thread_indices,
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
            // Data Export/Import
            data_export::export_data,
            data_export::import_data,
            // Decks
            decks::get_decks,
            decks::get_deck,
            decks::create_deck,
            decks::update_deck,
            decks::delete_deck,
            decks::reset_deck,
            decks::assign_phrase_to_deck,
            decks::assign_phrases_to_deck,
            decks::get_deck_phrases,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
