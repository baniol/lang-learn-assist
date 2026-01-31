mod common;

use axum::http::StatusCode;
use serde_json::json;

#[tokio::test]
async fn test_list_languages() {
    let server = common::spawn_test_server().await;

    let response = server.get("/api/languages").await;
    response.assert_status(StatusCode::OK);

    let languages: Vec<serde_json::Value> = response.json();
    // Dev user is seeded with German
    assert!(languages.iter().any(|l| l["target_language"] == "de"));
}

#[tokio::test]
async fn test_add_language() {
    let server = common::spawn_test_server().await;

    let response = server
        .post("/api/languages")
        .json(&json!({
            "target_language": "es"
        }))
        .await;
    response.assert_status(StatusCode::OK);

    let language: serde_json::Value = response.json();
    assert_eq!(language["target_language"], "es");
    assert_eq!(language["is_active"], true);

    // Clean up
    let id = language["id"].as_str().unwrap();
    server.delete(&format!("/api/languages/{}", id)).await;
}

#[tokio::test]
async fn test_add_duplicate_language_reactivates() {
    let server = common::spawn_test_server().await;

    // Add French
    let response = server
        .post("/api/languages")
        .json(&json!({ "target_language": "fr" }))
        .await;
    response.assert_status(StatusCode::OK);
    let first: serde_json::Value = response.json();

    // Add French again - should return same record (upsert)
    let response = server
        .post("/api/languages")
        .json(&json!({ "target_language": "fr" }))
        .await;
    response.assert_status(StatusCode::OK);
    let second: serde_json::Value = response.json();

    assert_eq!(first["id"], second["id"]);

    // Clean up
    let id = first["id"].as_str().unwrap();
    server.delete(&format!("/api/languages/{}", id)).await;
}

#[tokio::test]
async fn test_remove_language() {
    let server = common::spawn_test_server().await;

    // Add a language first
    let response = server
        .post("/api/languages")
        .json(&json!({ "target_language": "it" }))
        .await;
    let language: serde_json::Value = response.json();
    let id = language["id"].as_str().unwrap();

    // Remove it
    let response = server.delete(&format!("/api/languages/{}", id)).await;
    response.assert_status(StatusCode::OK);

    // Verify it's gone
    let response = server.get("/api/languages").await;
    let languages: Vec<serde_json::Value> = response.json();
    assert!(!languages.iter().any(|l| l["target_language"] == "it"));
}

#[tokio::test]
async fn test_remove_nonexistent_language() {
    let server = common::spawn_test_server().await;

    let response = server
        .delete("/api/languages/00000000-0000-0000-0000-000000000099")
        .await;
    response.assert_status(StatusCode::NOT_FOUND);
}
