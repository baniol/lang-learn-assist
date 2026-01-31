use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Phrase {
    pub id: Uuid,
    pub user_id: Uuid,
    pub question_id: Option<Uuid>,
    pub target_language: String,
    pub source_language: String,
    pub phrase: String,
    pub translation: Option<String>,
    pub context: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePhrase {
    pub phrase: String,
    pub translation: Option<String>,
    pub target_language: String,
    pub source_language: String,
    pub context: Option<String>,
    pub notes: Option<String>,
    pub question_id: Option<Uuid>,
    pub tag_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePhrase {
    pub phrase: Option<String>,
    pub translation: Option<String>,
    pub context: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PhraseWithTags {
    #[serde(flatten)]
    pub phrase: Phrase,
    pub tags: Vec<super::Tag>,
}

#[derive(Debug, Deserialize, Default)]
pub struct PhraseFilters {
    pub target_language: Option<String>,
    pub tag_id: Option<Uuid>,
}
