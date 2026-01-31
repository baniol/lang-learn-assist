use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct UserLanguage {
    pub id: Uuid,
    pub user_id: Uuid,
    pub target_language: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserLanguage {
    pub target_language: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct UserSettings {
    pub id: Uuid,
    pub user_id: Uuid,
    pub daily_goal: i32,
    pub session_limit: i32,
    pub failure_repetitions: i32,
    pub elevenlabs_voice_id: Option<String>,
    pub source_language: String,
    pub active_target_language: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserSettings {
    pub daily_goal: Option<i32>,
    pub session_limit: Option<i32>,
    pub failure_repetitions: Option<i32>,
    pub elevenlabs_voice_id: Option<String>,
    pub source_language: Option<String>,
    pub active_target_language: Option<String>,
}
