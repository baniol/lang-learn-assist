mod common;

use serde_json::{json, Value};
use uuid::Uuid;

#[tokio::test]
async fn test_create_question() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    let response = server
        .post("/api/questions")
        .json(&json!({
            "question": "How do I say hello in German?",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;

    response.assert_status_ok();

    let body: Value = response.json();
    assert_eq!(body["question"], "How do I say hello in German?");
    assert_eq!(body["target_language"], "de");
    assert_eq!(body["source_language"], "en");
    assert!(body["id"].is_string());
    assert!(body["response"].is_null());

    // Cleanup
    let id: Uuid = body["id"].as_str().unwrap().parse().unwrap();
    common::cleanup_question(&pool, id).await;
}

#[tokio::test]
async fn test_list_questions() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a question
    let create_response = server
        .post("/api/questions")
        .json(&json!({
            "question": "What is the word for cat?",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;
    let created: Value = create_response.json();
    let id: Uuid = created["id"].as_str().unwrap().parse().unwrap();

    // List questions
    let response = server.get("/api/questions").await;
    response.assert_status_ok();

    let body: Vec<Value> = response.json();
    assert!(body.iter().any(|q| q["question"] == "What is the word for cat?"));

    // Cleanup
    common::cleanup_question(&pool, id).await;
}

#[tokio::test]
async fn test_get_question() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a question
    let create_response = server
        .post("/api/questions")
        .json(&json!({
            "question": "How do I ask for directions?",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;
    let created: Value = create_response.json();
    let id = created["id"].as_str().unwrap();

    // Get the question
    let response = server.get(&format!("/api/questions/{}", id)).await;
    response.assert_status_ok();

    let body: Value = response.json();
    assert_eq!(body["question"], "How do I ask for directions?");
    assert_eq!(body["id"], id);
    assert!(body["phrases"].is_array());

    // Cleanup
    let uuid: Uuid = id.parse().unwrap();
    common::cleanup_question(&pool, uuid).await;
}

#[tokio::test]
async fn test_get_question_with_phrases() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a question
    let question_response = server
        .post("/api/questions")
        .json(&json!({
            "question": "How to greet someone?",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;
    let question: Value = question_response.json();
    let question_id = question["id"].as_str().unwrap();

    // Create a phrase linked to the question
    let phrase_response = server
        .post("/api/phrases")
        .json(&json!({
            "phrase": "Guten Morgen",
            "translation": "Good morning",
            "target_language": "de",
            "source_language": "en",
            "question_id": question_id
        }))
        .await;
    let phrase: Value = phrase_response.json();
    let phrase_id: Uuid = phrase["id"].as_str().unwrap().parse().unwrap();

    // Get the question - should include phrases
    let response = server.get(&format!("/api/questions/{}", question_id)).await;
    response.assert_status_ok();

    let body: Value = response.json();
    let phrases = body["phrases"].as_array().unwrap();
    assert_eq!(phrases.len(), 1);
    assert_eq!(phrases[0]["phrase"], "Guten Morgen");

    // Cleanup
    common::cleanup_phrase(&pool, phrase_id).await;
    let question_uuid: Uuid = question_id.parse().unwrap();
    common::cleanup_question(&pool, question_uuid).await;
}

#[tokio::test]
async fn test_delete_question() {
    let server = common::spawn_test_server().await;

    // Create a question
    let create_response = server
        .post("/api/questions")
        .json(&json!({
            "question": "How do I count to ten?",
            "target_language": "de",
            "source_language": "en"
        }))
        .await;
    let created: Value = create_response.json();
    let id = created["id"].as_str().unwrap();

    // Delete the question
    let response = server.delete(&format!("/api/questions/{}", id)).await;
    response.assert_status_ok();

    // Verify it's gone
    let get_response = server.get(&format!("/api/questions/{}", id)).await;
    get_response.assert_status(axum::http::StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_get_nonexistent_question() {
    let server = common::spawn_test_server().await;
    let fake_id = Uuid::new_v4();

    let response = server.get(&format!("/api/questions/{}", fake_id)).await;
    response.assert_status(axum::http::StatusCode::NOT_FOUND);
}
