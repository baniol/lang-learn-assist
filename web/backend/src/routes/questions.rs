use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use uuid::Uuid;

use crate::db;
use crate::error::AppError;
use crate::models::{CreateQuestion, Question, QuestionWithPhrases, DEV_USER_ID};
use crate::services;
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

#[derive(Debug, Serialize)]
pub struct CreateQuestionResponse {
    #[serde(flatten)]
    pub question: Question,
    pub suggested_phrases: Vec<services::SuggestedPhrase>,
}

async fn create_question(
    State(state): State<AppState>,
    Json(input): Json<CreateQuestion>,
) -> Result<Json<CreateQuestionResponse>, AppError> {
    // Create the question first
    let mut question = db::create_question(&state.db, DEV_USER_ID, &input).await?;

    // Call LLM if API key is configured
    let suggested_phrases = if let Some(ref api_key) = state.openai_api_key {
        match services::ask_question(
            api_key,
            &input.question,
            &input.source_language,
            &input.target_language,
        )
        .await
        {
            Ok(response) => {
                // Update question with the LLM response
                question = db::update_question_response(&state.db, question.id, &response.explanation).await?;
                response.phrases
            }
            Err(e) => {
                tracing::error!("LLM call failed: {:?}", e);
                vec![]
            }
        }
    } else {
        tracing::warn!("LLM not configured, returning empty phrases");
        vec![]
    };

    Ok(Json(CreateQuestionResponse {
        question,
        suggested_phrases,
    }))
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
