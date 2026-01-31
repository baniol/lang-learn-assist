mod common;

use serde_json::{json, Value};
use uuid::Uuid;

#[tokio::test]
async fn test_create_tag() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    let response = server
        .post("/api/tags")
        .json(&json!({
            "name": "test-tag-create",
            "color": "#ff0000"
        }))
        .await;

    response.assert_status(axum::http::StatusCode::CREATED);

    let body: Value = response.json();
    assert_eq!(body["name"], "test-tag-create");
    assert_eq!(body["color"], "#ff0000");
    assert!(body["id"].is_string());

    // Cleanup
    let id: Uuid = body["id"].as_str().unwrap().parse().unwrap();
    common::cleanup_tag(&pool, id).await;
}

#[tokio::test]
async fn test_list_tags() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a tag first
    let create_response = server
        .post("/api/tags")
        .json(&json!({
            "name": "test-tag-list",
            "color": "#00ff00"
        }))
        .await;
    let created: Value = create_response.json();
    let id: Uuid = created["id"].as_str().unwrap().parse().unwrap();

    // List tags
    let response = server.get("/api/tags").await;
    response.assert_status_ok();

    let body: Vec<Value> = response.json();
    assert!(body.iter().any(|t| t["name"] == "test-tag-list"));

    // Cleanup
    common::cleanup_tag(&pool, id).await;
}

#[tokio::test]
async fn test_get_tag() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a tag
    let create_response = server
        .post("/api/tags")
        .json(&json!({
            "name": "test-tag-get",
            "color": "#0000ff"
        }))
        .await;
    let created: Value = create_response.json();
    let id = created["id"].as_str().unwrap();

    // Get the tag
    let response = server.get(&format!("/api/tags/{}", id)).await;
    response.assert_status_ok();

    let body: Value = response.json();
    assert_eq!(body["name"], "test-tag-get");
    assert_eq!(body["id"], id);

    // Cleanup
    let uuid: Uuid = id.parse().unwrap();
    common::cleanup_tag(&pool, uuid).await;
}

#[tokio::test]
async fn test_update_tag() {
    let server = common::spawn_test_server().await;
    let pool = common::get_test_db().await;

    // Create a tag
    let create_response = server
        .post("/api/tags")
        .json(&json!({
            "name": "test-tag-update",
            "color": "#ffffff"
        }))
        .await;
    let created: Value = create_response.json();
    let id = created["id"].as_str().unwrap();

    // Update the tag
    let response = server
        .put(&format!("/api/tags/{}", id))
        .json(&json!({
            "name": "test-tag-updated",
            "color": "#000000"
        }))
        .await;
    response.assert_status_ok();

    let body: Value = response.json();
    assert_eq!(body["name"], "test-tag-updated");
    assert_eq!(body["color"], "#000000");

    // Cleanup
    let uuid: Uuid = id.parse().unwrap();
    common::cleanup_tag(&pool, uuid).await;
}

#[tokio::test]
async fn test_delete_tag() {
    let server = common::spawn_test_server().await;
    let _pool = common::get_test_db().await;

    // Create a tag
    let create_response = server
        .post("/api/tags")
        .json(&json!({
            "name": "test-tag-delete"
        }))
        .await;
    let created: Value = create_response.json();
    let id = created["id"].as_str().unwrap();

    // Delete the tag
    let response = server.delete(&format!("/api/tags/{}", id)).await;
    response.assert_status(axum::http::StatusCode::NO_CONTENT);

    // Verify it's gone
    let get_response = server.get(&format!("/api/tags/{}", id)).await;
    get_response.assert_status(axum::http::StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_get_nonexistent_tag() {
    let server = common::spawn_test_server().await;
    let fake_id = Uuid::new_v4();

    let response = server.get(&format!("/api/tags/{}", fake_id)).await;
    response.assert_status(axum::http::StatusCode::NOT_FOUND);
}
