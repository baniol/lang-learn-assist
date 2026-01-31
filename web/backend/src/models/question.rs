use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Question {
    pub id: Uuid,
    pub user_id: Uuid,
    pub target_language: String,
    pub source_language: String,
    pub question: String,
    pub response: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateQuestion {
    pub question: String,
    pub target_language: String,
    pub source_language: String,
}

#[derive(Debug, Serialize)]
pub struct QuestionWithPhrases {
    #[serde(flatten)]
    pub question: Question,
    pub phrases: Vec<super::Phrase>,
}
