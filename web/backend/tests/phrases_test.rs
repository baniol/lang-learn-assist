mod common;

use serde_json::{json, Value};
use uuid::Uuid;

#[tokio::test]
async fn test_create_phrase() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    let response = server
        .post("/api/phrases")
        .json(&json!({
            "phrase": "Hallo",
            "translation": "Hello",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);

    let body: Value = response.json();
    assert_eq!(body["phrase"], "Hallo");
    assert_eq!(body["translation"], "Hello");
    assert_eq!(body["target_language"], "de");
    assert_eq!(body["source_language"], "en");
    assert!(body["id"].is_string());
    assert!(body["tags"].is_array());

    // Cleanup
    let id: Uuid = body["id"].as_str().unwrap().parse().unwrap();
    common::cleanup_phrase(&pool, id).await;
}

#[tokio::test]
async fn test_create_phrase_with_tags() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a tag first
    let tag_response = server
        .post("/api/tags")
        .json(&json!({
            "name": "test-phrase-tag",
            "color": "#123456"
        }))
        .await;
    let tag: Value = tag_response.json();
    let tag_id = tag["id"].as_str().unwrap();

    // Create phrase with tag
    let response = server
        .post("/api/phrases")
        .json(&json!({
            "phrase": "Guten Tag",
            "translation": "Good day",
            "target_language": "de",
            "source_language": "en",
            "tag_ids": [tag_id]
        }))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);

    let body: Value = response.json();
    assert_eq!(body["phrase"], "Guten Tag");
    let tags = body["tags"].as_array().unwrap();
    assert_eq!(tags.len(), 1);
    assert_eq!(tags[0]["name"], "test-phrase-tag");

    // Cleanup
    let phrase_id: Uuid = body["id"].as_str().unwrap().parse().unwrap();
    common::cleanup_phrase(&pool, phrase_id).await;
    let tag_uuid: Uuid = tag_id.parse().unwrap();
    common::cleanup_tag(&pool, tag_uuid).await;
}

#[tokio::test]
async fn test_list_phrases() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a phrase
    let create_response = server
        .post("/api/phrases")
        .json(&json!({
            "phrase": "Auf Wiedersehen",
            "translation": "Goodbye",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;
    let created: Value = create_response.json();
    let id: Uuid = created["id"].as_str().unwrap().parse().unwrap();

    // List phrases
    let response = server.get("/api/phrases").await;
    response.assert_status_ok();

    let body: Vec<Value> = response.json();
    assert!(body.iter().any(|p| p["phrase"] == "Auf Wiedersehen"));

    // Cleanup
    common::cleanup_phrase(&pool, id).await;
}

#[tokio::test]
async fn test_list_phrases_with_filter() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create phrases in different languages
    let de_response = server
        .post("/api/phrases")
        .json(&json!({
            "phrase": "Danke",
            "translation": "Thanks",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;
    let de_phrase: Value = de_response.json();
    let de_id: Uuid = de_phrase["id"].as_str().unwrap().parse().unwrap();

    let fr_response = server
        .post("/api/phrases")
        .json(&json!({
            "phrase": "Merci",
            "translation": "Thanks",
            "target_language": "fr",
            "source_language": "en"
        }))
        .await;
    let fr_phrase: Value = fr_response.json();
    let fr_id: Uuid = fr_phrase["id"].as_str().unwrap().parse().unwrap();

    // Filter by target language
    let response = server.get("/api/phrases?target_language=de").await;
    response.assert_status_ok();

    let body: Vec<Value> = response.json();
    assert!(body.iter().all(|p| p["target_language"] == "de"));

    // Cleanup
    common::cleanup_phrase(&pool, de_id).await;
    common::cleanup_phrase(&pool, fr_id).await;
}

#[tokio::test]
async fn test_get_phrase() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a phrase
    let create_response = server
        .post("/api/phrases")
        .json(&json!({
            "phrase": "Bitte",
            "translation": "Please",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;
    let created: Value = create_response.json();
    let id = created["id"].as_str().unwrap();

    // Get the phrase
    let response = server.get(&format!("/api/phrases/{}", id)).await;
    response.assert_status_ok();

    let body: Value = response.json();
    assert_eq!(body["phrase"], "Bitte");
    assert_eq!(body["id"], id);

    // Cleanup
    let uuid: Uuid = id.parse().unwrap();
    common::cleanup_phrase(&pool, uuid).await;
}

#[tokio::test]
async fn test_update_phrase() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a phrase
    let create_response = server
        .post("/api/phrases")
        .json(&json!({
            "phrase": "Ja",
            "translation": "Yes",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;
    let created: Value = create_response.json();
    let id = created["id"].as_str().unwrap();

    // Update the phrase
    let response = server
        .put(&format!("/api/phrases/{}", id))
        .json(&json!({
            "translation": "Yes (affirmative)",
            "notes": "Common response"
        }))
        .await;
    response.assert_status_ok();

    let body: Value = response.json();
    assert_eq!(body["phrase"], "Ja");
    assert_eq!(body["translation"], "Yes (affirmative)");
    assert_eq!(body["notes"], "Common response");

    // Cleanup
    let uuid: Uuid = id.parse().unwrap();
    common::cleanup_phrase(&pool, uuid).await;
}

#[tokio::test]
async fn test_delete_phrase() {
    let server = common::spawn_test_server().await;

    // Create a phrase
    let create_response = server
        .post("/api/phrases")
        .json(&json!({
            "phrase": "Nein",
            "translation": "No",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;
    let created: Value = create_response.json();
    let id = created["id"].as_str().unwrap();

    // Delete the phrase
    let response = server.delete(&format!("/api/phrases/{}", id)).await;
    response.assert_status(axum::http::StatusCode::NO_CONTENT);

    // Verify it's gone
    let get_response = server.get(&format!("/api/phrases/{}", id)).await;
    get_response.assert_status(axum::http::StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_add_tags_to_phrase() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a phrase
    let phrase_response = server
        .post("/api/phrases")
        .json(&json!({
            "phrase": "Entschuldigung",
            "translation": "Excuse me",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;
    let phrase: Value = phrase_response.json();
    let phrase_id = phrase["id"].as_str().unwrap();

    // Create a tag
    let tag_response = server
        .post("/api/tags")
        .json(&json!({
            "name": "polite",
            "color": "#00ff00"
        }))
        .await;
    let tag: Value = tag_response.json();
    let tag_id = tag["id"].as_str().unwrap();

    // Add tag to phrase
    let response = server
        .post(&format!("/api/phrases/{}/tags", phrase_id))
        .json(&json!({
            "tag_ids": [tag_id]
        }))
        .await;
    response.assert_status_ok();

    let body: Value = response.json();
    let tags = body["tags"].as_array().unwrap();
    assert_eq!(tags.len(), 1);
    assert_eq!(tags[0]["name"], "polite");

    // Cleanup
    let phrase_uuid: Uuid = phrase_id.parse().unwrap();
    let tag_uuid: Uuid = tag_id.parse().unwrap();
    common::cleanup_phrase(&pool, phrase_uuid).await;
    common::cleanup_tag(&pool, tag_uuid).await;
}

#[tokio::test]
async fn test_remove_tag_from_phrase() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a tag
    let tag_response = server
        .post("/api/tags")
        .json(&json!({
            "name": "removable",
            "color": "#ff0000"
        }))
        .await;
    let tag: Value = tag_response.json();
    let tag_id = tag["id"].as_str().unwrap();

    // Create a phrase with the tag
    let phrase_response = server
        .post("/api/phrases")
        .json(&json!({
            "phrase": "Test phrase",
            "translation": "Test",
            "target_language": "de",
            "source_language": "en",
            "tag_ids": [tag_id]
        }))
        .await;
    let phrase: Value = phrase_response.json();
    let phrase_id = phrase["id"].as_str().unwrap();

    // Verify tag is there
    let tags = phrase["tags"].as_array().unwrap();
    assert_eq!(tags.len(), 1);

    // Remove the tag
    let response = server
        .delete(&format!("/api/phrases/{}/tags/{}", phrase_id, tag_id))
        .await;
    response.assert_status(axum::http::StatusCode::NO_CONTENT);

    // Verify tag is removed
    let get_response = server.get(&format!("/api/phrases/{}", phrase_id)).await;
    let body: Value = get_response.json();
    let tags = body["tags"].as_array().unwrap();
    assert!(tags.is_empty());

    // Cleanup
    let phrase_uuid: Uuid = phrase_id.parse().unwrap();
    let tag_uuid: Uuid = tag_id.parse().unwrap();
    common::cleanup_phrase(&pool, phrase_uuid).await;
    common::cleanup_tag(&pool, tag_uuid).await;
}
