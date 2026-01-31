mod common;

use serde_json::Value;

#[tokio::test]
async fn test_health_endpoint() {
    let server = common::spawn_test_server().await;

    let response = server.get("/health").await;

    response.assert_status_ok();

    let body: Value = response.json();
    assert_eq!(body["status"], "ok");
    assert!(body["version"].is_string());
}
