pub mod db;
pub mod error;
pub mod models;
pub mod routes;
pub mod services;

use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use sqlx::PgPool;
use tower_http::trace::TraceLayer;

// App state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub openai_api_key: Option<String>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
}

async fn health(State(_state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

/// Build the application router
pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .merge(routes::api_routes())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
