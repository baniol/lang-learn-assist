# Migration Plan: Desktop → Web

This document outlines the gradual migration of features from the Tauri desktop app to the web version.

---

## Development Philosophy

- **Infrastructure first** - CI/CD, deployment, storage before features
- **Flexible from day one** - Schema and APIs designed for multi-user, auth added later
- **One feature at a time** - Complete and test each feature before moving to next
- **Rethink, don't copy** - Each feature is an opportunity to improve UX

---

## Flexibility Strategy

To avoid redesigns when adding auth later:

### Database
- All tables have `user_id` foreign key from the start
- Use hardcoded `DEV_USER_ID` constant during development
- When auth is added, just start using real user IDs

### API Design
- All endpoints already scoped to user: `GET /api/phrases` (not `/api/users/:id/phrases`)
- User context extracted via middleware (returns hardcoded ID initially)
- When auth is added, middleware extracts real user from session

### Middleware Pattern
```rust
// Initially: returns hardcoded dev user
pub async fn extract_user(req: Request) -> Result<AuthUser, AppError> {
    Ok(AuthUser { id: DEV_USER_ID })
}

// Later: extracts from session cookie
pub async fn extract_user(req: Request, db: &Pool) -> Result<AuthUser, AppError> {
    let session = get_session_from_cookie(&req)?;
    let user = db.get_user_by_session(session).await?;
    Ok(AuthUser { id: user.id })
}
```

### Environment-based Config
```rust
// Config switches behavior
if config.auth_enabled {
    // Validate session, reject unauthorized
} else {
    // Return dev user, allow all requests
}
```

---

## Migration Phases

### Phase 0: Infrastructure
**Goal:** Dev environment, CI/CD, deployment pipeline ready.

See `INFRASTRUCTURE.md` for detailed cost research and Terraform structure.

#### Tasks
- [ ] Initialize Cargo project with Axum
- [ ] Docker setup (backend + postgres)
- [ ] Docker Compose for local dev
- [ ] Terraform modules (compute, storage, database)
- [ ] GitHub Actions CI (test, clippy, fmt)
- [ ] Dev deployment to Hetzner (VPS + Object Storage)
- [ ] GitHub Actions CD (deploy on push to main)
- [ ] Environment configuration (.env, secrets)
- [ ] Health check endpoint
- [ ] Basic logging (tracing)

#### Estimated Cost
- Hetzner CX22 (VPS): €3.79/mo
- Hetzner Object Storage: €4.99/mo
- Postgres: Docker container (€0) or Managed (€4.90+)
- **Total: ~€9-14/mo**

#### Deliverables
- `make dev` runs locally with Docker
- Push to `main` → deploys to dev server
- `/health` endpoint returns OK

#### CI Pipeline
```yaml
# .github/workflows/ci.yml
- cargo fmt --check
- cargo clippy -- -D warnings
- cargo test
- cargo build --release
```

#### CD Pipeline
```yaml
# .github/workflows/deploy.yml
- Build Docker image
- Push to registry
- SSH deploy to dev server (or use Docker Compose remote)
```

---

### Phase 1: Database + Storage
**Goal:** Schema in place, object storage working, basic CRUD.

#### Tasks
- [ ] PostgreSQL schema (all tables with user_id)
- [ ] sqlx migrations setup
- [ ] DEV_USER_ID constant and seeding
- [ ] Object storage client (S3-compatible)
- [ ] Phrases CRUD endpoints
- [ ] Audio file upload/download
- [ ] Basic frontend (list phrases, play audio)

#### Database Schema
Full schema in `DESIGN.md`. Key point: all tables reference `users(id)`.

```sql
-- Seed dev user (migration)
INSERT INTO users (id, email, email_verified)
VALUES ('00000000-0000-0000-0000-000000000001', 'dev@localhost', true)
ON CONFLICT DO NOTHING;
```

#### API Endpoints
```
GET    /api/phrases              # List phrases (dev user)
POST   /api/phrases              # Create phrase
GET    /api/phrases/:id          # Get phrase
PUT    /api/phrases/:id          # Update phrase
DELETE /api/phrases/:id          # Delete phrase
GET    /api/phrases/:id/audio    # Get/generate audio URL
POST   /api/audio/upload         # Upload audio file
```

---

### Phase 2: TTS Integration
**Goal:** Generate and play phrase audio with ElevenLabs.

#### Tasks
- [ ] ElevenLabs client (abstracted for other providers)
- [ ] Voice listing endpoint
- [ ] Audio generation on demand
- [ ] Audio caching in object storage
- [ ] User voice preference (stored in user_settings)
- [ ] Frontend audio player

#### Architecture
```rust
#[async_trait]
trait TtsProvider {
    async fn list_voices(&self, language: &str) -> Result<Vec<Voice>>;
    async fn synthesize(&self, text: &str, voice_id: &str) -> Result<Vec<u8>>;
}

struct ElevenLabsProvider { api_key: String }
// Other providers can be added later
```

#### API Endpoints
```
GET    /api/settings/voices      # List available ElevenLabs voices
GET    /api/phrases/:id/audio    # Get or generate audio
```

---

### Phase 3: SRS Practice
**Goal:** Spaced repetition practice loop working.

#### Tasks
- [ ] Port SM-2 algorithm from `learning.rs`
- [ ] Due phrases endpoint
- [ ] Answer submission + SRS update
- [ ] Practice session tracking
- [ ] Statistics endpoints
- [ ] Practice UI (manual + typing modes)
- [ ] User settings for learning params

#### Algorithm
Port from desktop `src-tauri/src/commands/learning.rs`:
- `calculate_priority()` - Which phrase to show next
- `calculate_srs()` - Update ease_factor, interval, next_review_at
- `validate_answer()` - Flexible matching with normalization

#### User Settings
```sql
-- Already in schema, used here
daily_goal, session_limit, failure_repetitions
```

#### API Endpoints
```
GET    /api/practice/due              # Get next phrase(s) for review
POST   /api/practice/answer           # Submit answer, get SRS update
GET    /api/practice/stats            # Learning statistics
GET    /api/settings                  # Get user settings
PUT    /api/settings                  # Update settings
```

---

### Phase 4: Conversations + AI
**Goal:** AI-powered translation conversations.

#### Tasks
- [ ] AI provider client (OpenAI/Anthropic abstraction)
- [ ] Conversation CRUD
- [ ] Message handling with AI responses
- [ ] Streaming responses (SSE)
- [ ] Conversation UI
- [ ] System prompts for translation context

#### Architecture
```rust
#[async_trait]
trait AiProvider {
    async fn complete(&self, messages: Vec<Message>) -> Result<String>;
    async fn stream(&self, messages: Vec<Message>) -> Result<impl Stream<Item = String>>;
}
```

#### API Endpoints
```
GET    /api/conversations                    # List conversations
POST   /api/conversations                    # Create conversation
GET    /api/conversations/:id                # Get with messages
DELETE /api/conversations/:id                # Delete
POST   /api/conversations/:id/messages       # Send message
GET    /api/conversations/:id/stream         # SSE for streaming
```

---

### Phase 5: Authentication
**Goal:** Real users, sessions, OAuth.

#### Tasks
- [ ] Enable auth middleware (flip config flag)
- [ ] Email + password registration
- [ ] Password hashing (argon2)
- [ ] Session management (cookies)
- [ ] Google OAuth
- [ ] Email verification (optional initially)
- [ ] Password reset
- [ ] Login/register UI
- [ ] Protected routes in frontend

#### Implementation
- Middleware already exists, just validates sessions now
- All endpoints already scoped to user
- Just need login/register endpoints + UI

#### API Endpoints
```
POST   /api/auth/register        # Email + password
POST   /api/auth/login           # Login
POST   /api/auth/logout          # Logout
GET    /api/auth/me              # Current user
POST   /api/auth/google          # OAuth initiate
GET    /api/auth/google/callback # OAuth callback
```

---

### Phase 6: Phrase Extraction
**Goal:** Extract phrases from conversations.

#### Tasks
- [ ] AI extraction prompt
- [ ] Batch phrase creation
- [ ] Link phrases to source conversation
- [ ] Extraction UI in conversation view

#### API Endpoints
```
POST   /api/conversations/:id/extract   # Extract phrases
POST   /api/phrases/batch               # Create multiple
```

---

### Phase 7: Polish & Extras
**Goal:** Nice-to-have features.

#### Features
- [ ] Grammar Q&A
- [ ] Phrase refinement (AI suggestions)
- [ ] GDPR (data export, account deletion)
- [ ] User settings page
- [ ] Mobile-responsive UI
- [ ] PWA setup (manifest, service worker)
- [ ] Speaking mode (Web Speech API)

---

## Feature Inventory

| Feature | Desktop | Priority | Phase | Notes |
|---------|---------|----------|-------|-------|
| Infrastructure | N/A | P0 | 0 | CI/CD, deployment |
| Phrases CRUD | Complete | P0 | 1 | Core feature |
| Audio Storage | Complete | P0 | 1 | Object storage |
| TTS (ElevenLabs) | Complete | P1 | 2 | Voice selection |
| SRS Practice | Complete | P1 | 3 | Core learning |
| Conversations | Complete | P1 | 4 | AI translation |
| Authentication | N/A | P1 | 5 | Multi-user |
| Phrase Extraction | Complete | P2 | 6 | AI-powered |
| Grammar Q&A | Complete | P3 | 7 | Nice to have |
| Speaking Mode | Complete | P3 | 7 | Web Speech API |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-01 | Infrastructure before features | Need CI/CD and deployment first |
| 2025-01 | Auth deferred to Phase 5 | Build core features faster, schema ready from start |
| 2025-01 | DEV_USER_ID pattern | Keeps code multi-user ready without auth complexity |
| 2025-01 | ElevenLabs for TTS | High quality voices, good variety |
| 2025-01 | AWS Transcribe for STT | Voice recognition in speaking mode |
| 2025-01 | Provider abstractions | Easy to swap AI/TTS/STT providers later |
| 2025-01 | Backend-managed API keys | Users select preferences, not provide keys |

---

## Open Questions

1. **Dev deployment provider?**
   - Hetzner (cheapest, EU)
   - DigitalOcean (simple, good DX)
   - Fly.io (easy Docker deploys)

2. **Container registry?**
   - GitHub Container Registry (free with Actions)
   - Provider's registry

3. **Database for dev?**
   - Docker container on same VPS
   - Managed Postgres (more cost)

---

## References

- Desktop code: `src-tauri/src/commands/`
- SRS algorithm: `src-tauri/src/commands/learning.rs`
- LLM integration: `src-tauri/src/commands/llm.rs`
- STT patterns: `~/projects/voice-notes-app` (AWS Transcribe)
- Voice services: ElevenLabs (TTS), AWS Transcribe (STT)
- Web design: `web/DESIGN.md`
- Infrastructure & costs: `web/INFRASTRUCTURE.md`
