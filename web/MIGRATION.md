# Migration Plan: Desktop → Web

Gradual migration of features from the Tauri desktop app to the web version.

---

## Development Philosophy

- **Infrastructure first** - CI/CD, deployment before features
- **Q&A first** - Start with questions/translations, confirm each feature before building
- **Flexible from day one** - Schema designed for multi-user, auth added later
- **One feature at a time** - Complete and test before moving to next

---

## Language Model

**Terminology:**
- **Source language** - User's native language (e.g., English)
- **Target language** - Language being learned (e.g., German, Spanish)

**Multi-language support:**
- One source language per user (configurable in settings)
- Multiple target languages supported
- Separate phrase library per target language
- Separate learning progress per target language
- User can switch active target language

```
User (source: English)
├── Target: German
│   ├── Phrases (German)
│   └── Progress (German)
├── Target: Spanish
│   ├── Phrases (Spanish)
│   └── Progress (Spanish)
└── Target: French
    ├── Phrases (French)
    └── Progress (French)
```

---

## Flexibility Strategy

### DEV_USER_ID Pattern
- All tables have `user_id` from the start
- Use hardcoded UUID during development
- Switch to real users when auth is added
- No schema changes needed

### Middleware Pattern
```rust
// Dev: returns hardcoded user
pub async fn extract_user() -> Result<AuthUser, AppError> {
    Ok(AuthUser { id: DEV_USER_ID })
}

// Later: extracts from session
pub async fn extract_user(req: Request, db: &Pool) -> Result<AuthUser, AppError> {
    let session = get_session_from_cookie(&req)?;
    Ok(AuthUser { id: session.user_id })
}
```

---

## Migration Phases

### Phase 0: Infrastructure
**Goal:** Dev environment, CI/CD, deployment ready.

See `INFRASTRUCTURE.md` for details.

#### Tasks
- [ ] Initialize Cargo project with Axum
- [ ] Docker setup (backend + postgres)
- [ ] Docker Compose for local dev
- [ ] GitHub Actions CI (test, clippy, fmt)
- [ ] Terraform for Hetzner (VPS + Object Storage)
- [ ] GitHub Actions CD (deploy on push)
- [ ] Health check endpoint
- [ ] Basic logging

#### Deliverables
- `docker-compose up` works locally
- `/health` returns OK
- Push to main deploys to dev server

---

### Phase 1: Q&A / Translations
**Goal:** Ask questions, get LLM responses with phrases to confirm.

This is the core learning flow - ask for translations, vocabulary, grammar explanations.
LLM returns phrases that user can confirm and save.

#### Tasks
- [ ] PostgreSQL schema (users, questions, phrases)
- [ ] sqlx migrations
- [ ] DEV_USER_ID seeding
- [ ] AI provider client (OpenAI/Anthropic)
- [ ] Questions endpoints (ask, list history)
- [ ] LLM prompt for returning structured phrases
- [ ] Frontend: Question input, response display
- [ ] Frontend: Confirm/save phrases from response
- [ ] Language selector (source + target)

#### Database Tables
- `users` - Basic user record
- `user_settings` - Source language, active target
- `user_languages` - User's target languages
- `questions` - Q&A history
- `phrases` - Confirmed phrases (per target language)

#### API Endpoints
```
POST   /api/questions              # Ask a question
GET    /api/questions              # List past questions
GET    /api/questions/:id          # Get specific Q&A

POST   /api/phrases                # Save confirmed phrase
GET    /api/phrases                # List phrases (filtered by target_language)
DELETE /api/phrases/:id            # Delete phrase

GET    /api/languages              # List user's target languages
POST   /api/languages              # Add target language
DELETE /api/languages/:id          # Remove target language
PUT    /api/settings               # Update source language, active target
```

#### LLM Response Format
```json
{
  "explanation": "Here's how to say...",
  "phrases": [
    {
      "phrase": "Ich möchte einen Kaffee",
      "translation": "I would like a coffee",
      "context": "Ordering at a café"
    }
  ]
}
```

---

### Phase 2: Phrases Library
**Goal:** Manage saved phrases, basic CRUD.

#### Tasks
- [ ] Phrases list with filtering (by target language)
- [ ] Edit phrase (phrase, translation, notes)
- [ ] Star/exclude phrases
- [ ] Search phrases
- [ ] Link to source question

#### API Endpoints
```
GET    /api/phrases                # List with filters
PUT    /api/phrases/:id            # Update phrase
POST   /api/phrases/:id/star       # Toggle star
POST   /api/phrases/:id/exclude    # Toggle exclude
```

---

### Phase 3: TTS Integration
**Goal:** Generate and play phrase audio.

#### Tasks
- [ ] ElevenLabs client
- [ ] Voice listing (per language)
- [ ] Audio generation on demand
- [ ] Audio caching in object storage
- [ ] Voice preference per target language
- [ ] Frontend audio player

#### API Endpoints
```
GET    /api/settings/voices        # List voices for language
GET    /api/phrases/:id/audio      # Get or generate audio
```

---

### Phase 4: SRS Practice
**Goal:** Spaced repetition learning.

#### Tasks
- [ ] Port SM-2 algorithm from desktop `learning.rs`
- [ ] Due phrases endpoint (per target language)
- [ ] Answer submission + SRS update
- [ ] Practice modes (manual reveal, typing)
- [ ] Session tracking
- [ ] Statistics

#### API Endpoints
```
GET    /api/practice/due           # Get due phrases
POST   /api/practice/answer        # Submit answer
GET    /api/practice/stats         # Learning stats
```

---

### Phase 5: Conversations
**Goal:** AI translation conversations (more structured than Q&A).

#### Tasks
- [ ] Conversation CRUD
- [ ] Message handling with streaming
- [ ] Phrase extraction from conversation
- [ ] Conversation templates

---

### Phase 6: Authentication
**Goal:** Real users, sessions, OAuth.

#### Tasks
- [ ] Enable auth middleware
- [ ] Email + password registration
- [ ] Google OAuth
- [ ] Session management
- [ ] Login/register UI

---

### Phase 7: Polish
**Goal:** Nice-to-haves.

- [ ] STT / Speaking mode (AWS Transcribe)
- [ ] GDPR (data export, deletion)
- [ ] PWA setup
- [ ] Mobile-responsive UI

---

## Feature Confirmation

Before implementing each feature from desktop, confirm:

| Desktop Feature | Web? | Changes? |
|----------------|------|----------|
| Q&A / Grammar questions | ✓ Phase 1 | First feature |
| Phrases library | ✓ Phase 2 | Per target language |
| TTS (audio) | ✓ Phase 3 | ElevenLabs |
| SRS Practice | ✓ Phase 4 | Same algorithm |
| Conversations | ? Phase 5 | Confirm needed |
| Phrase extraction | ? Phase 5 | Part of conversations |
| Phrase refinement | ? | Confirm needed |
| Speaking mode | ? Phase 7 | AWS Transcribe |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-01 | Q&A as first feature | Core value, validates LLM integration |
| 2025-01 | Source/target terminology | Clearer than native/target |
| 2025-01 | Multi-target support | Users learn multiple languages |
| 2025-01 | Separate phrase libraries | Each target has own progress |
| 2025-01 | Auth deferred to Phase 6 | Build features first |
| 2025-01 | ElevenLabs for TTS | High quality voices |
| 2025-01 | AWS Transcribe for STT | Voice recognition |

---

## References

- Desktop code: `src-tauri/src/commands/`
- SRS algorithm: `src-tauri/src/commands/learning.rs`
- LLM integration: `src-tauri/src/commands/llm.rs`
- STT patterns: `~/projects/voice-notes-app` (AWS Transcribe)
- Web design: `web/DESIGN.md`
- Infrastructure: `web/INFRASTRUCTURE.md`
