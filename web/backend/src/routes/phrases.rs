use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::db;
use crate::error::AppError;
use crate::models::{CreatePhrase, PhraseFilters, PhraseWithTags, UpdatePhrase, DEV_USER_ID};
use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/phrases", get(list_phrases).post(create_phrase))
        .route("/api/phrases/:id", get(get_phrase).put(update_phrase).delete(delete_phrase))
        .route("/api/phrases/:id/tags", post(add_tags_to_phrase))
        .route("/api/phrases/:phrase_id/tags/:tag_id", axum::routing::delete(remove_tag_from_phrase))
}

async fn list_phrases(
    State(state): State<AppState>,
    Query(filters): Query<PhraseFilters>,
) -> Result<Json<Vec<PhraseWithTags>>, AppError> {
    let phrases = db::list_phrases(&state.db, DEV_USER_ID, &filters).await?;

    let mut result = Vec::with_capacity(phrases.len());
    for phrase in phrases {
        let tags = db::get_tags_for_phrase(&state.db, phrase.id).await?;
        result.push(PhraseWithTags { phrase, tags });
    }

    Ok(Json(result))
}

async fn create_phrase(
    State(state): State<AppState>,
    Json(input): Json<CreatePhrase>,
) -> Result<(StatusCode, Json<PhraseWithTags>), AppError> {
    let phrase = db::create_phrase(&state.db, DEV_USER_ID, &input).await?;

    // Add tags if provided
    if let Some(tag_ids) = &input.tag_ids {
        for tag_id in tag_ids {
            db::add_tag_to_phrase(&state.db, phrase.id, *tag_id, DEV_USER_ID).await?;
        }
    }

    let tags = db::get_tags_for_phrase(&state.db, phrase.id).await?;
    Ok((StatusCode::CREATED, Json(PhraseWithTags { phrase, tags })))
}

async fn get_phrase(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<PhraseWithTags>, AppError> {
    let phrase = db::get_phrase(&state.db, id, DEV_USER_ID).await?;
    let tags = db::get_tags_for_phrase(&state.db, id).await?;
    Ok(Json(PhraseWithTags { phrase, tags }))
}

async fn update_phrase(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdatePhrase>,
) -> Result<Json<PhraseWithTags>, AppError> {
    let phrase = db::update_phrase(&state.db, id, DEV_USER_ID, &input).await?;
    let tags = db::get_tags_for_phrase(&state.db, id).await?;
    Ok(Json(PhraseWithTags { phrase, tags }))
}

async fn delete_phrase(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    db::delete_phrase(&state.db, id, DEV_USER_ID).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct AddTagsRequest {
    tag_ids: Vec<Uuid>,
}

async fn add_tags_to_phrase(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<AddTagsRequest>,
) -> Result<Json<PhraseWithTags>, AppError> {
    let phrase = db::get_phrase(&state.db, id, DEV_USER_ID).await?;

    for tag_id in input.tag_ids {
        db::add_tag_to_phrase(&state.db, id, tag_id, DEV_USER_ID).await?;
    }

    let tags = db::get_tags_for_phrase(&state.db, id).await?;
    Ok(Json(PhraseWithTags { phrase, tags }))
}

async fn remove_tag_from_phrase(
    State(state): State<AppState>,
    Path((phrase_id, tag_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    db::remove_tag_from_phrase(&state.db, phrase_id, tag_id, DEV_USER_ID).await?;
    Ok(StatusCode::NO_CONTENT)
}
