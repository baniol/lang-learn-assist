use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::*;

// Questions

pub async fn create_question(
    pool: &PgPool,
    user_id: Uuid,
    input: &CreateQuestion,
) -> Result<Question, AppError> {
    let question = sqlx::query_as::<_, Question>(
        r#"
        INSERT INTO questions (user_id, question, target_language, source_language)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(&input.question)
    .bind(&input.target_language)
    .bind(&input.source_language)
    .fetch_one(pool)
    .await?;

    Ok(question)
}

pub async fn update_question_response(
    pool: &PgPool,
    id: Uuid,
    response: &str,
) -> Result<Question, AppError> {
    let question = sqlx::query_as::<_, Question>(
        r#"
        UPDATE questions SET response = $1 WHERE id = $2
        RETURNING *
        "#,
    )
    .bind(response)
    .bind(id)
    .fetch_one(pool)
    .await?;

    Ok(question)
}

pub async fn get_question(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<Question, AppError> {
    sqlx::query_as::<_, Question>(
        "SELECT * FROM questions WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Question not found".to_string()))
}

pub async fn list_questions(pool: &PgPool, user_id: Uuid) -> Result<Vec<Question>, AppError> {
    let questions = sqlx::query_as::<_, Question>(
        "SELECT * FROM questions WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(questions)
}

pub async fn delete_question(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM questions WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Question not found".to_string()));
    }

    Ok(())
}

// Phrases

pub async fn create_phrase(
    pool: &PgPool,
    user_id: Uuid,
    input: &CreatePhrase,
) -> Result<Phrase, AppError> {
    let phrase = sqlx::query_as::<_, Phrase>(
        r#"
        INSERT INTO phrases (user_id, phrase, translation, target_language, source_language, context, notes, question_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(&input.phrase)
    .bind(&input.translation)
    .bind(&input.target_language)
    .bind(&input.source_language)
    .bind(&input.context)
    .bind(&input.notes)
    .bind(input.question_id)
    .fetch_one(pool)
    .await?;

    Ok(phrase)
}

pub async fn get_phrase(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<Phrase, AppError> {
    sqlx::query_as::<_, Phrase>("SELECT * FROM phrases WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Phrase not found".to_string()))
}

pub async fn list_phrases(
    pool: &PgPool,
    user_id: Uuid,
    filters: &PhraseFilters,
) -> Result<Vec<Phrase>, AppError> {
    let phrases = match (&filters.tag_id, &filters.target_language) {
        (Some(tag_id), Some(lang)) => {
            sqlx::query_as::<_, Phrase>(
                r#"
                SELECT p.* FROM phrases p
                JOIN phrase_tags pt ON p.id = pt.phrase_id
                WHERE p.user_id = $1 AND pt.tag_id = $2 AND p.target_language = $3
                ORDER BY p.created_at DESC
                "#,
            )
            .bind(user_id)
            .bind(tag_id)
            .bind(lang)
            .fetch_all(pool)
            .await?
        }
        (Some(tag_id), None) => {
            sqlx::query_as::<_, Phrase>(
                r#"
                SELECT p.* FROM phrases p
                JOIN phrase_tags pt ON p.id = pt.phrase_id
                WHERE p.user_id = $1 AND pt.tag_id = $2
                ORDER BY p.created_at DESC
                "#,
            )
            .bind(user_id)
            .bind(tag_id)
            .fetch_all(pool)
            .await?
        }
        (None, Some(lang)) => {
            sqlx::query_as::<_, Phrase>(
                r#"
                SELECT * FROM phrases
                WHERE user_id = $1 AND target_language = $2
                ORDER BY created_at DESC
                "#,
            )
            .bind(user_id)
            .bind(lang)
            .fetch_all(pool)
            .await?
        }
        (None, None) => {
            sqlx::query_as::<_, Phrase>(
                r#"
                SELECT * FROM phrases
                WHERE user_id = $1
                ORDER BY created_at DESC
                "#,
            )
            .bind(user_id)
            .fetch_all(pool)
            .await?
        }
    };

    Ok(phrases)
}

pub async fn update_phrase(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    input: &UpdatePhrase,
) -> Result<Phrase, AppError> {
    // First check if phrase exists and belongs to user
    let existing = get_phrase(pool, id, user_id).await?;

    let phrase = sqlx::query_as::<_, Phrase>(
        r#"
        UPDATE phrases SET
            phrase = COALESCE($1, phrase),
            translation = COALESCE($2, translation),
            context = COALESCE($3, context),
            notes = COALESCE($4, notes)
        WHERE id = $5
        RETURNING *
        "#,
    )
    .bind(input.phrase.as_ref().unwrap_or(&existing.phrase))
    .bind(&input.translation)
    .bind(&input.context)
    .bind(&input.notes)
    .bind(id)
    .fetch_one(pool)
    .await?;

    Ok(phrase)
}

pub async fn delete_phrase(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM phrases WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Phrase not found".to_string()));
    }

    Ok(())
}

pub async fn get_phrases_by_question(
    pool: &PgPool,
    question_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<Phrase>, AppError> {
    let phrases = sqlx::query_as::<_, Phrase>(
        "SELECT * FROM phrases WHERE question_id = $1 AND user_id = $2 ORDER BY created_at",
    )
    .bind(question_id)
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(phrases)
}

// Tags

pub async fn create_tag(pool: &PgPool, user_id: Uuid, input: &CreateTag) -> Result<Tag, AppError> {
    let tag = sqlx::query_as::<_, Tag>(
        r#"
        INSERT INTO tags (user_id, name, color)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(&input.name)
    .bind(&input.color)
    .fetch_one(pool)
    .await?;

    Ok(tag)
}

pub async fn get_tag(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<Tag, AppError> {
    sqlx::query_as::<_, Tag>("SELECT * FROM tags WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Tag not found".to_string()))
}

pub async fn list_tags(pool: &PgPool, user_id: Uuid) -> Result<Vec<Tag>, AppError> {
    let tags = sqlx::query_as::<_, Tag>(
        "SELECT * FROM tags WHERE user_id = $1 ORDER BY name",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(tags)
}

pub async fn update_tag(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    input: &UpdateTag,
) -> Result<Tag, AppError> {
    let existing = get_tag(pool, id, user_id).await?;

    let tag = sqlx::query_as::<_, Tag>(
        r#"
        UPDATE tags SET
            name = COALESCE($1, name),
            color = COALESCE($2, color)
        WHERE id = $3
        RETURNING *
        "#,
    )
    .bind(input.name.as_ref().unwrap_or(&existing.name))
    .bind(&input.color)
    .bind(id)
    .fetch_one(pool)
    .await?;

    Ok(tag)
}

pub async fn delete_tag(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM tags WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Tag not found".to_string()));
    }

    Ok(())
}

// Phrase-Tag associations

pub async fn add_tag_to_phrase(
    pool: &PgPool,
    phrase_id: Uuid,
    tag_id: Uuid,
    user_id: Uuid,
) -> Result<(), AppError> {
    // Verify ownership
    get_phrase(pool, phrase_id, user_id).await?;
    get_tag(pool, tag_id, user_id).await?;

    sqlx::query("INSERT INTO phrase_tags (phrase_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
        .bind(phrase_id)
        .bind(tag_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn remove_tag_from_phrase(
    pool: &PgPool,
    phrase_id: Uuid,
    tag_id: Uuid,
    user_id: Uuid,
) -> Result<(), AppError> {
    // Verify ownership
    get_phrase(pool, phrase_id, user_id).await?;

    sqlx::query("DELETE FROM phrase_tags WHERE phrase_id = $1 AND tag_id = $2")
        .bind(phrase_id)
        .bind(tag_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn get_tags_for_phrase(pool: &PgPool, phrase_id: Uuid) -> Result<Vec<Tag>, AppError> {
    let tags = sqlx::query_as::<_, Tag>(
        r#"
        SELECT t.* FROM tags t
        JOIN phrase_tags pt ON t.id = pt.tag_id
        WHERE pt.phrase_id = $1
        ORDER BY t.name
        "#,
    )
    .bind(phrase_id)
    .fetch_all(pool)
    .await?;

    Ok(tags)
}
