mod commands;
mod constants;
mod db;
mod models;
mod state;
mod utils;

use commands::{
    audio, data_export, exercise, llm, materials, phrases, practice, settings, tags, tts,
};
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Settings
            settings::get_settings,
            settings::save_settings,
            // Phrases
            phrases::get_phrases,
            phrases::get_phrase,
            phrases::create_phrase,
            phrases::create_phrases_batch,
            phrases::update_phrase,
            phrases::toggle_starred,
            phrases::update_phrase_audio,
            phrases::delete_phrase,
            phrases::delete_all_phrases,
            // Phrase threads
            phrases::get_phrase_thread,
            phrases::create_phrase_thread,
            phrases::update_phrase_thread,
            phrases::accept_phrase_thread,
            phrases::delete_phrase_thread,
            // LLM
            llm::client::test_llm_connection,
            llm::phrase::refine_phrase,
            llm::phrase::generate_title,
            llm::phrase::generate_phrases,
            llm::material::process_material,
            llm::material::estimate_material_tokens,
            llm::material::ask_about_sentence,
            llm::translation::preview_phrase_translation,
            llm::translation::apply_phrase_translation,
            // Materials
            materials::create_material,
            materials::get_materials,
            materials::get_material,
            materials::update_material,
            materials::delete_material,
            materials::delete_all_materials,
            materials::update_material_bookmark,
            materials::get_material_thread,
            materials::create_material_thread,
            materials::update_material_thread,
            materials::delete_material_thread,
            materials::get_material_thread_indices,
            // Practice
            practice::get_practice_sessions,
            practice::create_practice_session,
            practice::update_practice_session,
            practice::delete_practice_session,
            practice::practice_send_message,
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
            // Exercise
            exercise::check_exercise_answer,
            exercise::save_exercise_session,
            exercise::get_exercise_calendar,
            exercise::get_exercise_day_details,
            exercise::get_all_exercise_sessions,
            exercise::delete_exercise_session,
            // Tags
            tags::get_tags,
            tags::create_tag,
            tags::delete_tag,
            tags::add_tag_to_phrase,
            tags::remove_tag_from_phrase,
            tags::get_phrase_tags,
            // Data Export/Import
            data_export::export_data,
            data_export::import_data,
            data_export::find_duplicate_phrases,
            data_export::remove_duplicate_phrases,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
