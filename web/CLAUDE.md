# CLAUDE.md - Web Version

Language learning web app: Rust/Axum backend + vanilla JS frontend. Gradual migration from Tauri desktop app.

## Development Approach

**Auth-deferred:** Using `DEV_USER_ID` pattern until Phase 5. All code is multi-user ready:
- Schema has `user_id` on all tables
- Middleware extracts user (hardcoded initially, from session later)
- Config flag `auth_enabled` switches behavior
- No redesign needed when adding auth

## Quick Reference

```bash
# From web/ directory
make dev          # Run backend + serve frontend
make build        # Production build
make test         # Run all tests
make migrate      # Run database migrations
make check        # Cargo check + clippy
```

## Project Structure

```
web/
├── backend/
│   ├── Cargo.toml
│   ├── migrations/           # SQL migrations (sqlx)
│   └── src/
│       ├── main.rs           # Entry point, server setup
│       ├── config.rs         # Environment config
│       ├── error.rs          # Error types, responses
│       ├── routes/           # HTTP handlers
│       │   ├── mod.rs
│       │   ├── auth.rs
│       │   ├── phrases.rs
│       │   ├── practice.rs
│       │   ├── conversations.rs
│       │   └── account.rs
│       ├── services/         # Business logic
│       │   ├── mod.rs
│       │   ├── auth.rs
│       │   ├── srs.rs
│       │   ├── ai.rs
│       │   └── email.rs
│       ├── models/           # Database models
│       ├── db/               # Database queries
│       └── middleware/       # Auth, logging, etc.
├── frontend/
│   ├── index.html
│   ├── css/
│   └── js/
│       ├── app.js
│       ├── api.js
│       └── views/
├── DESIGN.md                 # Architecture decisions
├── MIGRATION.md              # Feature migration plan
└── CLAUDE.md                 # This file
```

## Commands

### Backend Development

```bash
cd web/backend

# Development
cargo run                     # Start server
cargo watch -x run            # Auto-reload on changes

# Testing
cargo test                    # Run tests
cargo test -- --nocapture     # With output

# Database
sqlx migrate run              # Apply migrations
sqlx migrate add <name>       # Create new migration

# Checks
cargo check                   # Fast compilation check
cargo clippy                  # Lints
cargo fmt                     # Format code
```

### Frontend Development

```bash
cd web/frontend

# For now, just serve static files
python -m http.server 3000    # Or any static server
```

## Adding Features

### New API Endpoint

1. **Add route handler** in `src/routes/{domain}.rs`:
```rust
pub async fn get_phrases(
    State(state): State<AppState>,
    user: AuthUser,  // Extracted from middleware
    Query(params): Query<PhraseFilters>,
) -> Result<Json<Vec<Phrase>>, AppError> {
    let phrases = state.db.get_phrases(user.id, &params).await?;
    Ok(Json(phrases))
}
```

2. **Register route** in `src/routes/mod.rs`:
```rust
pub fn api_routes() -> Router<AppState> {
    Router::new()
        .route("/phrases", get(phrases::get_phrases))
        .route("/phrases", post(phrases::create_phrase))
        // ...
}
```

3. **Add database query** in `src/db/phrases.rs`:
```rust
pub async fn get_phrases(
    pool: &PgPool,
    user_id: Uuid,
    filters: &PhraseFilters,
) -> Result<Vec<Phrase>, sqlx::Error> {
    sqlx::query_as!(
        Phrase,
        r#"SELECT * FROM phrases WHERE user_id = $1"#,
        user_id
    )
    .fetch_all(pool)
    .await
}
```

4. **Add frontend API call** in `js/api.js`:
```javascript
export async function getPhrases(filters = {}) {
    const params = new URLSearchParams(filters);
    const res = await fetch(`/api/phrases?${params}`, {
        credentials: 'include'
    });
    return handleResponse(res);
}
```

### New Database Migration

1. Create migration:
```bash
cd web/backend
sqlx migrate add create_phrases_table
```

2. Write SQL in `migrations/YYYYMMDD_create_phrases_table.sql`:
```sql
CREATE TABLE phrases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    -- ... fields
);

CREATE INDEX idx_phrases_user_id ON phrases(user_id);
```

3. Run migration:
```bash
sqlx migrate run
```

### New Service (Business Logic)

1. Create `src/services/{name}.rs`
2. Export in `src/services/mod.rs`
3. Keep services stateless - pass dependencies as arguments
4. Services should NOT know about HTTP (no Request/Response types)

```rust
// Good: Pure business logic
pub async fn calculate_next_review(
    current_ease: f64,
    current_interval: i32,
    is_correct: bool,
) -> SrsUpdate {
    // ...
}

// Bad: HTTP concerns in service
pub async fn calculate_next_review(req: Request) -> Response {
    // Don't do this
}
```

## Patterns

### Error Handling

Use the `AppError` type for all errors:

```rust
#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    Unauthorized,
    Validation(String),
    Database(sqlx::Error),
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".into()),
            // ...
        };

        Json(json!({
            "error": { "code": status.as_str(), "message": message }
        })).into_response()
    }
}
```

### Authentication

Auth is handled via middleware that extracts `AuthUser`:

```rust
// In route handler - user is automatically extracted and verified
pub async fn my_handler(user: AuthUser) -> Result<Json<Data>, AppError> {
    // user.id is guaranteed to be valid
}

// For optional auth (public routes that behave differently when logged in)
pub async fn my_handler(user: Option<AuthUser>) -> Result<Json<Data>, AppError> {
    if let Some(user) = user {
        // Logged in
    } else {
        // Anonymous
    }
}
```

### Database Queries

Use sqlx with compile-time checked queries:

```rust
// Type-safe query
let phrase = sqlx::query_as!(
    Phrase,
    r#"
    SELECT id, user_id, prompt, answer, created_at
    FROM phrases
    WHERE id = $1 AND user_id = $2
    "#,
    phrase_id,
    user_id
)
.fetch_optional(&pool)
.await?
.ok_or(AppError::NotFound("Phrase not found".into()))?;
```

### Frontend API Client

All API calls go through `api.js`:

```javascript
// api.js
const API_BASE = '/api';

async function handleResponse(res) {
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error?.message || 'Unknown error');
    }
    return data;
}

export async function getPhrases() {
    const res = await fetch(`${API_BASE}/phrases`, {
        credentials: 'include'  // Important for cookies
    });
    return handleResponse(res);
}

export async function createPhrase(phrase) {
    const res = await fetch(`${API_BASE}/phrases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(phrase)
    });
    return handleResponse(res);
}
```

## Important Guidelines

### Security
- Always validate user ownership: `WHERE user_id = $user_id`
- Use parameterized queries (sqlx does this automatically)
- Hash passwords with argon2
- Store session tokens hashed
- Set secure cookie flags: HttpOnly, Secure, SameSite

### Performance
- Use database indexes on frequently queried columns
- Paginate list endpoints
- Cache expensive computations (consider Redis later)

### Code Style
- Keep handlers thin - delegate to services
- One file per domain in routes/
- Tests alongside implementation or in tests/

### When Porting from Desktop

Reference files in `src-tauri/src/commands/`:
- `learning.rs` - SRS algorithm, practice logic
- `llm.rs` - AI integration patterns
- `phrases.rs` - Phrase CRUD patterns

Key differences:
- Desktop uses SQLite, web uses PostgreSQL
- Desktop uses Tauri state, web uses Axum state
- Desktop returns `Result<T, String>`, web returns `Result<Json<T>, AppError>`

## Testing

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_create_phrase

# Run with logging
RUST_LOG=debug cargo test -- --nocapture
```

Test pattern:
```rust
#[tokio::test]
async fn test_create_phrase() {
    let pool = setup_test_db().await;
    let user = create_test_user(&pool).await;

    let phrase = create_phrase(&pool, user.id, CreatePhraseRequest {
        prompt: "Hello".into(),
        answer: "Hallo".into(),
        // ...
    }).await.unwrap();

    assert_eq!(phrase.prompt, "Hello");
}
```

## Environment Variables

See `DESIGN.md` for full list. Key ones:

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/langlearn
RUST_LOG=info
SESSION_SECRET=your-secret-key
OAUTH_GOOGLE_CLIENT_ID=...
OAUTH_GOOGLE_CLIENT_SECRET=...
AI_API_KEY=...                    # Backend-managed, not user-configurable
ELEVENLABS_API_KEY=...            # TTS - voice generation
AWS_ACCESS_KEY_ID=...             # STT - voice recognition (Transcribe)
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1
```

**Note:** All provider API keys are backend-managed via env vars (`.env` file). Users configure preferences (voice selection, learning params) via settings page, not their own API keys.

## Reference Documents

- `DESIGN.md` - Architecture, schema, API design
- `MIGRATION.md` - Feature migration plan from desktop
- `INFRASTRUCTURE.md` - Cloud costs, Terraform, CI/CD
- `../DOCUMENTATION.md` - User-facing feature docs (desktop)
- `../src-tauri/src/` - Desktop Rust implementation to reference
