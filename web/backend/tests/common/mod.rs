use axum_test::TestServer;
use langlearn_web::{create_router, AppState};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::sync::atomic::{AtomicBool, Ordering};
use uuid::Uuid;

/// Flag to track if migrations have been run
static MIGRATIONS_RUN: AtomicBool = AtomicBool::new(false);

/// Create a fresh database pool
pub async fn get_test_db() -> PgPool {
    dotenvy::dotenv().ok();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for tests");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Run migrations only once
    if !MIGRATIONS_RUN.swap(true, Ordering::SeqCst) {
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Failed to run migrations");
    }

    pool
}

/// Create a test server with real database
pub async fn spawn_test_server() -> TestServer {
    let db = get_test_db().await;
    let state = AppState {
        db,
        openai_api_key: None, // Disable LLM in tests
    };
    let app = create_router(state);
    TestServer::builder()
        .save_cookies()
        .build(app)
        .expect("Failed to create test server")
}

/// Dev user ID for tests
#[allow(dead_code)]
pub const DEV_USER_ID: &str = "00000000-0000-0000-0000-000000000001";

/// Clean up test data by ID
#[allow(dead_code)]
pub async fn cleanup_tag(pool: &PgPool, id: Uuid) {
    let _ = sqlx::query("DELETE FROM tags WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await;
}

#[allow(dead_code)]
pub async fn cleanup_phrase(pool: &PgPool, id: Uuid) {
    let _ = sqlx::query("DELETE FROM phrases WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await;
}

#[allow(dead_code)]
pub async fn cleanup_question(pool: &PgPool, id: Uuid) {
    let _ = sqlx::query("DELETE FROM questions WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await;
}
