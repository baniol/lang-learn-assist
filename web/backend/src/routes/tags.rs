use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::db;
use crate::error::AppError;
use crate::models::{CreateTag, Tag, UpdateTag, DEV_USER_ID};
use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/tags", get(list_tags).post(create_tag))
        .route("/api/tags/:id", get(get_tag).put(update_tag).delete(delete_tag))
}

async fn list_tags(State(state): State<AppState>) -> Result<Json<Vec<Tag>>, AppError> {
    let tags = db::list_tags(&state.db, DEV_USER_ID).await?;
    Ok(Json(tags))
}

async fn create_tag(
    State(state): State<AppState>,
    Json(input): Json<CreateTag>,
) -> Result<(StatusCode, Json<Tag>), AppError> {
    let tag = db::create_tag(&state.db, DEV_USER_ID, &input).await?;
    Ok((StatusCode::CREATED, Json(tag)))
}

async fn get_tag(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Tag>, AppError> {
    let tag = db::get_tag(&state.db, id, DEV_USER_ID).await?;
    Ok(Json(tag))
}

async fn update_tag(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateTag>,
) -> Result<Json<Tag>, AppError> {
    let tag = db::update_tag(&state.db, id, DEV_USER_ID, &input).await?;
    Ok(Json(tag))
}

async fn delete_tag(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::delete_tag(&state.db, id, DEV_USER_ID).await?;
    Ok(StatusCode::NO_CONTENT)
}
