use axum::{
    extract::State,
    routing::get,
    Json, Router,
};

use crate::db;
use crate::error::AppError;
use crate::models::{UpdateUserSettings, UserSettings, DEV_USER_ID};
use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/settings", get(get_settings).put(update_settings))
}

async fn get_settings(State(state): State<AppState>) -> Result<Json<UserSettings>, AppError> {
    let settings = db::get_user_settings(&state.db, DEV_USER_ID).await?;
    Ok(Json(settings))
}

async fn update_settings(
    State(state): State<AppState>,
    Json(input): Json<UpdateUserSettings>,
) -> Result<Json<UserSettings>, AppError> {
    let settings = db::update_user_settings(&state.db, DEV_USER_ID, &input).await?;
    Ok(Json(settings))
}
