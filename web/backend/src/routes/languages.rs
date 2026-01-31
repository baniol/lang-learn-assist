use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::db;
use crate::error::AppError;
use crate::models::{CreateUserLanguage, UserLanguage, DEV_USER_ID};
use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/languages", get(list_languages).post(add_language))
        .route("/api/languages/:id", axum::routing::delete(remove_language))
}

async fn list_languages(
    State(state): State<AppState>,
) -> Result<Json<Vec<UserLanguage>>, AppError> {
    let languages = db::list_user_languages(&state.db, DEV_USER_ID).await?;
    Ok(Json(languages))
}

async fn add_language(
    State(state): State<AppState>,
    Json(input): Json<CreateUserLanguage>,
) -> Result<Json<UserLanguage>, AppError> {
    let language = db::add_user_language(&state.db, DEV_USER_ID, &input).await?;
    Ok(Json(language))
}

async fn remove_language(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    db::remove_user_language(&state.db, id, DEV_USER_ID).await
}
