# Web Version Design Document

Language learning app with AI-powered phrase generation and SRS practice.

## Goals

- Web-accessible version of the desktop app
- Scalable for higher traffic
- Cloud-agnostic deployment (EU-preferred providers)
- Gradual feature migration from Tauri desktop app

## Development Approach

**Auth-deferred pattern:** Schema and APIs are multi-user ready from day one, but auth is implemented in Phase 5. During development:

- All tables have `user_id` foreign key
- Hardcoded `DEV_USER_ID` used until auth is enabled
- Middleware pattern allows flipping auth on/off via config
- No redesign needed when adding auth

```rust
// DEV_USER_ID constant
pub const DEV_USER_ID: Uuid = uuid!("00000000-0000-0000-0000-000000000001");

// Config-driven auth
pub struct Config {
    pub auth_enabled: bool,  // false during dev, true in production
}
```

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Static Frontend │────▶│   Rust Backend  │────▶│   PostgreSQL    │
│  (HTML/CSS/JS)  │     │     (Axum)      │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Object Storage │
                        │ (S3-compatible) │
                        └─────────────────┘
```

### Components

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Backend | Rust + Axum | Performance, type safety, familiar from Tauri |
| Database | PostgreSQL | Relational + JSONB, available on all cloud providers |
| Object Storage | S3-compatible | Cloud-agnostic, all target providers support it |
| Frontend | Static HTML/CSS/JS | Simple, cacheable, CDN-friendly |
| Cache (future) | Redis | Session storage, rate limiting, caching |

---

## Cloud Strategy

### Target Providers (EU-preferred)

| Provider | Region | PostgreSQL | Object Storage | Notes |
|----------|--------|------------|----------------|-------|
| Hetzner | Germany/Finland | Self-managed or managed | S3-compatible | Best price/performance |
| Scaleway | France/Netherlands | Managed | S3-compatible | Good EU option |
| OVHCloud | France | Managed | S3-compatible (Swift) | EU data sovereignty |
| DigitalOcean | Amsterdam/Frankfurt | Managed | Spaces (S3-compatible) | Simple, good DX |
| AWS | eu-central-1, eu-west-1 | RDS | S3 | Fallback, most features |

### Abstraction Approach

- Use environment variables for all provider-specific config
- S3 client with configurable endpoint (works with all S3-compatible stores)
- Standard PostgreSQL connection string
- No provider-specific SDK dependencies

```rust
// Example: S3 abstraction
struct StorageConfig {
    endpoint: String,      // "https://s3.eu-central-1.amazonaws.com" or "https://s3.fr-par.scw.cloud"
    bucket: String,
    access_key: String,
    secret_key: String,
    region: String,
}
```

---

## Database Design

### PostgreSQL Schema

Simplified schema focused on phrase generation and learning:

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  -- NULL for OAuth-only users
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth accounts linked to users
CREATE TABLE oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,  -- 'google', 'github', etc.
    provider_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

-- Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's target languages (supports multiple)
CREATE TABLE user_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_language VARCHAR(10) NOT NULL,  -- Language being learned (e.g., 'de', 'es')
    is_active BOOLEAN DEFAULT TRUE,        -- Currently learning
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, target_language)
);

-- Questions: Single entry point for LLM interaction
-- User asks → LLM responds → Phrases extracted
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_language VARCHAR(10) NOT NULL,
    source_language VARCHAR(10) NOT NULL,
    question TEXT NOT NULL,               -- User's prompt/question
    response TEXT,                        -- LLM response
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User's tags (for organizing phrases)
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7),                     -- Hex color e.g. '#ff5733'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Phrases (extracted from questions or manually added)
CREATE TABLE phrases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE SET NULL,
    target_language VARCHAR(10) NOT NULL,
    source_language VARCHAR(10) NOT NULL,
    phrase TEXT NOT NULL,                 -- Target language phrase
    translation TEXT,                     -- Source language translation
    context TEXT,                         -- Usage context
    notes TEXT,                           -- User notes
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phrase-tag associations (many-to-many)
CREATE TABLE phrase_tags (
    phrase_id UUID REFERENCES phrases(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (phrase_id, tag_id)
);

-- SRS progress
CREATE TABLE phrase_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phrase_id UUID REFERENCES phrases(id) ON DELETE CASCADE,
    ease_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    next_review_at TIMESTAMPTZ,
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(phrase_id)
);

-- Email verification tokens
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    -- Learning parameters
    daily_goal INTEGER DEFAULT 20,
    session_limit INTEGER DEFAULT 10,
    failure_repetitions INTEGER DEFAULT 3,
    -- TTS preferences
    elevenlabs_voice_id VARCHAR(100),
    -- Languages
    source_language VARCHAR(10) DEFAULT 'en',
    active_target_language VARCHAR(10),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_languages_user_id ON user_languages(user_id);
CREATE INDEX idx_questions_user_id ON questions(user_id);
CREATE INDEX idx_questions_target_language ON questions(user_id, target_language);
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_phrases_user_id ON phrases(user_id);
CREATE INDEX idx_phrases_target_language ON phrases(user_id, target_language);
CREATE INDEX idx_phrases_question_id ON phrases(question_id);
CREATE INDEX idx_phrase_tags_tag_id ON phrase_tags(tag_id);
CREATE INDEX idx_phrase_progress_next_review ON phrase_progress(next_review_at);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token_hash);
CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token_hash);
```

### Migration Strategy

- Use `sqlx` with compile-time checked queries
- Migrations in `web/backend/migrations/`
- Run migrations on app startup (with lock for multi-instance)

---

## Authentication

### Strategy

Flexible auth system supporting:
1. OAuth providers (Google first, extensible)
2. Email + password (Phase 1)

### OAuth Flow

```
┌────────┐     ┌─────────┐     ┌──────────┐     ┌────────┐
│ Client │────▶│ Backend │────▶│ Provider │────▶│ Backend │
│        │     │ /auth/  │     │ (Google) │     │ /auth/  │
│        │     │ google  │     │          │     │ callback│
└────────┘     └─────────┘     └──────────┘     └────────┘
                                                     │
                                                     ▼
                                              ┌────────────┐
                                              │ Create/Get │
                                              │ User +     │
                                              │ Session    │
                                              └────────────┘
```

### Tech Stack

| Concern | Crate | Notes |
|---------|-------|-------|
| OAuth2 flows | `oauth2` | Provider-agnostic OAuth2 client |
| Password hashing | `argon2` | Industry standard, memory-hard |
| Session tokens | `rand` + `sha256` | Generate secure random, store hash |
| JWT (optional) | `jsonwebtoken` | If stateless auth needed later |
| Email sending | `lettre` | SMTP client for verification/reset emails |

### Session Management

- Server-side sessions stored in PostgreSQL
- Session token in HTTP-only cookie
- Token rotation on sensitive actions
- Configurable expiry (default: 7 days)

### Adding New OAuth Providers

```rust
// Config-driven provider setup
struct OAuthProvider {
    name: String,
    client_id: String,
    client_secret: String,
    auth_url: String,
    token_url: String,
    scopes: Vec<String>,
    userinfo_url: String,
}

// Environment-based configuration
// OAUTH_GOOGLE_CLIENT_ID, OAUTH_GOOGLE_CLIENT_SECRET
// OAUTH_GITHUB_CLIENT_ID, OAUTH_GITHUB_CLIENT_SECRET (future)
```

---

## Object Storage

### Use Cases

- User uploads (future: audio recordings, images)
- AI-generated content (TTS audio files)
- Export files (vocabulary lists, progress reports)

### Interface

```rust
#[async_trait]
trait ObjectStorage {
    async fn put(&self, key: &str, data: &[u8], content_type: &str) -> Result<String>;
    async fn get(&self, key: &str) -> Result<Vec<u8>>;
    async fn delete(&self, key: &str) -> Result<()>;
    async fn presigned_url(&self, key: &str, expires_in: Duration) -> Result<String>;
}

// S3-compatible implementation
struct S3Storage {
    client: aws_sdk_s3::Client,
    bucket: String,
}
```

### Key Structure

```
/{user_id}/audio/{uuid}.mp3
/{user_id}/exports/{timestamp}-vocabulary.csv
/{user_id}/uploads/{uuid}-{filename}
```

---

## API Design

### REST Endpoints

```
# Auth - OAuth
POST   /api/auth/google              # Initiate Google OAuth
GET    /api/auth/google/callback     # OAuth callback

# Auth - Email + Password
POST   /api/auth/register            # Register with email/password
POST   /api/auth/login               # Login with email/password
POST   /api/auth/verify-email        # Verify email with token
POST   /api/auth/resend-verification # Resend verification email
POST   /api/auth/forgot-password     # Request password reset
POST   /api/auth/reset-password      # Reset password with token

# Auth - Common
POST   /api/auth/logout              # End session
GET    /api/auth/me                  # Current user info

# Account (GDPR)
GET    /api/account/export           # Export all user data (JSON)
DELETE /api/account                  # Delete account + all data

# Questions (LLM interaction for phrase generation)
GET    /api/questions                # List user's questions
POST   /api/questions                # Ask question, get LLM response
GET    /api/questions/:id            # Get question with extracted phrases
DELETE /api/questions/:id            # Delete question

# Tags
GET    /api/tags                     # List user's tags
POST   /api/tags                     # Create tag
PUT    /api/tags/:id                 # Update tag (name, color)
DELETE /api/tags/:id                 # Delete tag

# Phrases
GET    /api/phrases                  # List phrases (filter by tag, language)
POST   /api/phrases                  # Add phrase manually
PUT    /api/phrases/:id              # Update phrase
DELETE /api/phrases/:id              # Delete phrase
POST   /api/phrases/:id/tags         # Add tags to phrase
DELETE /api/phrases/:id/tags/:tag_id # Remove tag from phrase

# SRS / Practice
GET    /api/practice/due             # Get phrases due for review
POST   /api/practice/review          # Submit review result

# User settings
GET    /api/settings                 # Get user settings
PUT    /api/settings                 # Update user settings
GET    /api/settings/voices          # List available ElevenLabs voices
```

### Response Format

```json
{
    "data": { ... },
    "error": null
}

// or on error
{
    "data": null,
    "error": {
        "code": "UNAUTHORIZED",
        "message": "Session expired"
    }
}
```

### Streaming (AI responses)

For LLM responses, use Server-Sent Events (SSE):

```
POST /api/questions/stream

event: token
data: {"content": "Hello"}

event: token
data: {"content": " there"}

event: done
data: {"question_id": "uuid"}
```

---

## Backend Structure

```
web/backend/
├── Cargo.toml
├── migrations/
│   └── 001_initial.sql
├── src/
│   ├── main.rs              # Entry point, server setup
│   ├── config.rs            # Environment config
│   ├── error.rs             # Error types
│   ├── routes/
│   │   ├── mod.rs
│   │   ├── auth.rs          # Auth endpoints
│   │   ├── questions.rs     # LLM Q&A endpoints
│   │   ├── phrases.rs       # Phrase CRUD
│   │   ├── tags.rs          # Tag management
│   │   └── practice.rs      # SRS practice
│   ├── services/
│   │   ├── mod.rs
│   │   ├── auth.rs          # Auth logic
│   │   ├── ai.rs            # AI/LLM integration
│   │   ├── srs.rs           # Spaced repetition algorithm
│   │   └── phrases.rs       # Phrase extraction from LLM response
│   ├── models/
│   │   ├── mod.rs
│   │   ├── user.rs
│   │   ├── question.rs
│   │   ├── phrase.rs
│   │   ├── tag.rs
│   │   └── session.rs
│   ├── db/
│   │   ├── mod.rs
│   │   └── queries/         # SQL queries (sqlx)
│   └── storage/
│       ├── mod.rs
│       └── s3.rs
└── tests/
    └── ...
```

---

## Frontend Structure

Start minimal, expand as needed:

```
web/frontend/
├── index.html
├── css/
│   ├── variables.css        # Theme variables
│   ├── reset.css
│   ├── base.css
│   └── components.css
├── js/
│   ├── app.js               # Router + main app logic
│   ├── api.js               # API client
│   ├── views/
│   │   ├── home.js
│   │   ├── ask.js           # Question/LLM interaction
│   │   ├── phrases.js       # Phrase library with tags
│   │   ├── practice.js      # SRS review
│   │   └── settings.js
│   └── components/
│       └── ...
└── assets/
    └── ...
```

### Tech Decisions

- **No build step initially** - vanilla JS with ES modules
- **Minimal dependencies** - fetch API, no jQuery
- **Progressive enhancement** - works without JS for basic pages
- **PWA-ready** - structure supports adding manifest + service worker in Phase 4
- **Future option** - migrate to React/Vue/Svelte if complexity warrants

---

## Configuration

### Environment Variables

All provider API keys and secrets are managed via environment variables in the backend.
Users cannot configure their own API keys - they use the app's shared providers.

Users CAN configure (via settings page):
- Voice selection (from available ElevenLabs voices)
- Learning parameters (daily goal, session limit, etc.)
- Default languages

```bash
# Server
HOST=0.0.0.0
PORT=8080
RUST_LOG=info

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/langlearn

# Object Storage (S3-compatible)
S3_ENDPOINT=https://s3.eu-central-1.amazonaws.com
S3_BUCKET=langlearn-storage
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_REGION=eu-central-1

# OAuth - Google
OAUTH_GOOGLE_CLIENT_ID=...
OAUTH_GOOGLE_CLIENT_SECRET=...
OAUTH_GOOGLE_REDIRECT_URI=https://app.example.com/api/auth/google/callback

# OAuth - GitHub (future)
# OAUTH_GITHUB_CLIENT_ID=...
# OAUTH_GITHUB_CLIENT_SECRET=...

# AI Provider (backend-managed, not user-configurable)
AI_PROVIDER=openai  # or anthropic
AI_API_KEY=...
AI_MODEL=gpt-4o-mini

# TTS - ElevenLabs (voice generation)
ELEVENLABS_API_KEY=...
TTS_PROVIDER=elevenlabs

# STT - AWS Transcribe (voice recognition)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1
STT_PROVIDER=transcribe

# Email (for verification, password reset)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=noreply@example.com

# App
APP_URL=https://app.example.com
SESSION_SECRET=...  # For cookie signing
SESSION_EXPIRY_DAYS=7
```

---

## Deployment

### Container Strategy

```dockerfile
# Multi-stage build
FROM rust:1.75 AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/langlearn-web /usr/local/bin/
COPY web/frontend /var/www/frontend
CMD ["langlearn-web"]
```

### Docker Compose (Development)

```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/langlearn
    depends_on:
      - db

  frontend:
    image: nginx:alpine
    ports:
      - "3000:80"
    volumes:
      - ./frontend:/usr/share/nginx/html:ro

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: langlearn
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### Production Considerations

- Run multiple backend instances behind load balancer
- Use managed PostgreSQL (or replicated self-hosted)
- CDN for static frontend assets
- Health check endpoint: `GET /health`
- Graceful shutdown handling

---

## Security Checklist

- [ ] HTTPS everywhere (TLS termination at load balancer)
- [ ] HTTP-only, Secure, SameSite cookies
- [ ] CSRF protection for state-changing requests
- [ ] Rate limiting on auth endpoints
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries via sqlx)
- [ ] XSS prevention (escape output, CSP headers)
- [ ] Secrets in environment variables, never in code
- [ ] Dependency auditing (`cargo audit`)

---

## Migration Plan from Desktop

### Phase 1: Core (Questions + Phrases)
- [ ] Questions API (LLM integration)
- [ ] Phrase extraction from LLM responses
- [ ] Phrases CRUD
- [ ] Tags CRUD
- [ ] Frontend: Ask view, Phrases view

### Phase 2: SRS Practice
- [ ] SRS algorithm (port from `learning.rs`)
- [ ] Practice endpoints
- [ ] Practice UI

### Phase 3: TTS (Audio)
- [ ] ElevenLabs integration
- [ ] Object storage for audio files
- [ ] Audio playback in practice

### Phase 4: Auth + Polish
- [ ] Google OAuth authentication
- [ ] Email + password authentication
- [ ] GDPR endpoints (data export, account deletion)
- [ ] Settings and preferences
- [ ] PWA setup (manifest, service worker, offline support)

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Email + password | Phase 1 - implement alongside OAuth |
| Real-time (WebSocket) | Design for it, implement only if needed |
| Mobile strategy | PWA (Progressive Web App) |
| Monetization | Skip for now, keep extensible (see below) |
| GDPR | Consider from day 1 (see below) |

---

## GDPR Compliance

Built-in from Phase 1:

### Data Portability (Article 20)
- `GET /api/account/export` returns all user data as JSON
- Includes: profile, questions, phrases, tags, progress
- Response format allows easy import to other services

### Right to Erasure (Article 17)
- `DELETE /api/account` removes all user data
- Cascading deletes via `ON DELETE CASCADE` in schema
- Also removes data from object storage

### Implementation
```rust
// Export endpoint returns structured data
#[derive(Serialize)]
struct UserDataExport {
    user: UserProfile,
    questions: Vec<QuestionExport>,
    phrases: Vec<PhraseExport>,
    tags: Vec<TagExport>,
    progress: Vec<ProgressExport>,
    exported_at: DateTime<Utc>,
}

// Deletion is atomic
async fn delete_account(user_id: Uuid, db: &Pool, storage: &S3Storage) -> Result<()> {
    // 1. Delete from object storage (user's folder)
    storage.delete_prefix(&format!("{}/", user_id)).await?;
    // 2. Delete from database (cascades to all related tables)
    sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
        .execute(db)
        .await?;
    Ok(())
}
```

### Privacy Policy
- Required: document what data is collected and why
- Required: contact information for data requests
- Your responsibility to provide legal text

---

## Future: Monetization

**Status:** Not implementing now, but schema is extensible.

When needed, add:

```sql
-- User tier (add to users table)
ALTER TABLE users ADD COLUMN tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN tier_expires_at TIMESTAMPTZ;

-- For Stripe/Paddle integration
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);

-- Usage tracking (optional, for limits)
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    ai_messages_count INTEGER DEFAULT 0,
    phrases_stored INTEGER DEFAULT 0,
    UNIQUE(user_id, period_start)
);
```

**Possible tiers:**
| Tier | Limits |
|------|--------|
| Free | X conversations/month, Y phrases max |
| Pro | Unlimited |

**Note:** Current schema supports this without breaking changes - just add columns/tables when ready.

---

## Future: Real-time Features

**Status:** Not implementing now, design allows adding later.

**When needed:**
- WebSocket endpoint for live updates
- Use cases: collaborative learning, live typing indicators, instant sync

**Axum supports this:**
```rust
// Can add later without restructuring
async fn ws_handler(ws: WebSocketUpgrade, user: User) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, user))
}
```

---

## PWA Strategy

Progressive Web App for mobile access:

### Phase 4 Implementation
- `manifest.json` for installability
- Service worker for offline support
- Cache API for offline phrase review
- Push notifications for review reminders (optional)

### Minimal manifest.json
```json
{
    "name": "Language Learning Assistant",
    "short_name": "LangLearn",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#4a90d9",
    "icons": [
        { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
        { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" }
    ]
}
```

### Offline Capabilities (future)
- Cache phrases locally for offline review
- Queue reviews when offline, sync when back online
- Service worker handles background sync

---

## References

- Desktop app: `src-tauri/src/` (Rust backend logic)
- SRS algorithm: `src-tauri/src/learning.rs`
- Current schema: `src-tauri/src/db.rs`
- Feature docs: `DOCUMENTATION.md`
