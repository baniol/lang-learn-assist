use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::db;
use crate::error::AppError;
use crate::models::{CreateQuestion, Question, QuestionWithPhrases, DEV_USER_ID};
use crate::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/questions", get(list_questions).post(create_question))
        .route("/api/questions/:id", get(get_question).delete(delete_question))
}

async fn list_questions(State(state): State<AppState>) -> Result<Json<Vec<Question>>, AppError> {
    let questions = db::list_questions(&state.db, DEV_USER_ID).await?;
    Ok(Json(questions))
}

async fn create_question(
    State(state): State<AppState>,
    Json(input): Json<CreateQuestion>,
) -> Result<Json<Question>, AppError> {
    let question = db::create_question(&state.db, DEV_USER_ID, &input).await?;
    Ok(Json(question))
}

async fn get_question(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<QuestionWithPhrases>, AppError> {
    let question = db::get_question(&state.db, id, DEV_USER_ID).await?;
    let phrases = db::get_phrases_by_question(&state.db, id, DEV_USER_ID).await?;

    Ok(Json(QuestionWithPhrases { question, phrases }))
}

async fn delete_question(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<(), AppError> {
    db::delete_question(&state.db, id, DEV_USER_ID).await
}
