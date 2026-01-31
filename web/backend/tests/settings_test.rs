mod common;

use axum::http::StatusCode;
use serde_json::json;

#[tokio::test]
async fn test_get_settings() {
    let server = common::spawn_test_server().await;

    let response = server.get("/api/settings").await;
    response.assert_status(StatusCode::OK);

    let settings: serde_json::Value = response.json();
    // Dev user is seeded with these defaults
    assert_eq!(settings["source_language"], "en");
    assert_eq!(settings["active_target_language"], "de");
    assert_eq!(settings["daily_goal"], 20);
    assert_eq!(settings["session_limit"], 10);
    assert_eq!(settings["failure_repetitions"], 3);
}

#[tokio::test]
async fn test_update_settings_source_language() {
    let server = common::spawn_test_server().await;

    let response = server
        .put("/api/settings")
        .json(&json!({
            "source_language": "pl"
        }))
        .await;
    response.assert_status(StatusCode::OK);

    let settings: serde_json::Value = response.json();
    assert_eq!(settings["source_language"], "pl");

    // Reset to original
    server
        .put("/api/settings")
        .json(&json!({ "source_language": "en" }))
        .await;
}

#[tokio::test]
async fn test_update_settings_active_target() {
    let server = common::spawn_test_server().await;

    // First add Spanish as a language
    server
        .post("/api/languages")
        .json(&json!({ "target_language": "es" }))
        .await;

    // Set it as active
    let response = server
        .put("/api/settings")
        .json(&json!({
            "active_target_language": "es"
        }))
        .await;
    response.assert_status(StatusCode::OK);

    let settings: serde_json::Value = response.json();
    assert_eq!(settings["active_target_language"], "es");

    // Reset to German
    server
        .put("/api/settings")
        .json(&json!({ "active_target_language": "de" }))
        .await;
}

#[tokio::test]
async fn test_update_settings_learning_params() {
    let server = common::spawn_test_server().await;

    let response = server
        .put("/api/settings")
        .json(&json!({
            "daily_goal": 30,
            "session_limit": 15,
            "failure_repetitions": 5
        }))
        .await;
    response.assert_status(StatusCode::OK);

    let settings: serde_json::Value = response.json();
    assert_eq!(settings["daily_goal"], 30);
    assert_eq!(settings["session_limit"], 15);
    assert_eq!(settings["failure_repetitions"], 5);

    // Reset to defaults
    server
        .put("/api/settings")
        .json(&json!({
            "daily_goal": 20,
            "session_limit": 10,
            "failure_repetitions": 3
        }))
        .await;
}

#[tokio::test]
async fn test_update_settings_partial() {
    let server = common::spawn_test_server().await;

    // Only update daily_goal, other fields should remain unchanged
    let response = server
        .put("/api/settings")
        .json(&json!({
            "daily_goal": 25
        }))
        .await;
    response.assert_status(StatusCode::OK);

    let settings: serde_json::Value = response.json();
    assert_eq!(settings["daily_goal"], 25);
    assert_eq!(settings["source_language"], "en"); // Unchanged
    assert_eq!(settings["session_limit"], 10); // Unchanged

    // Reset
    server
        .put("/api/settings")
        .json(&json!({ "daily_goal": 20 }))
        .await;
}
