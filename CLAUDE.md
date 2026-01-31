# CLAUDE.md

Web version of language learning app. Rust/Axum backend + vanilla JS frontend. Migrating features from desktop app.

## Current Status

**Branch:** `web`
**Current Phase:** 1 - Q&A + Phrases (backend complete, frontend pending)

Completed:
- Backend scaffold (Axum) with `/health` endpoint
- Docker/Podman Compose (backend + postgres + nginx)
- Frontend scaffold (vanilla JS, CSS variables, router)
- PostgreSQL schema + migrations (all tables)
- Dev user seeding (`DEV_USER_ID` pattern)
- Full CRUD APIs: questions, phrases, tags
- Phrase-tag associations (add/remove)
- Integration tests (22 tests passing)

## Next Steps

Complete Phase 1:
1. **LLM integration** - Generate phrase suggestions from questions
2. **Frontend views** - Questions page, Phrases library, Tags management

See `web/MIGRATION.md` for detailed tasks.

## Commands

```bash
cd web/backend
cargo run                     # Start server
cargo watch -x run            # Auto-reload on changes
cargo test                    # Run tests
cargo check && cargo clippy   # Check + lint
sqlx migrate run              # Apply migrations
sqlx migrate add <name>       # Create new migration
```

## Project Structure

```
web/
├── backend/                  # Rust/Axum server
│   ├── migrations/           # SQL migrations (sqlx)
│   └── src/
│       ├── routes/           # HTTP handlers
│       ├── services/         # Business logic
│       ├── models/           # Database models
│       └── db/               # Database queries
├── frontend/                 # Static HTML/CSS/JS
├── DESIGN.md                 # Architecture, schema, API design
├── MIGRATION.md              # Feature migration plan (phases 1-8)
└── CLAUDE.md                 # Web dev guide (detailed)
```

## Adding Features

See `web/CLAUDE.md` for detailed patterns. Quick reference:

1. **Route handler** in `src/routes/{domain}.rs`
2. **Register route** in `src/routes/mod.rs`
3. **Database query** in `src/db/{domain}.rs`
4. **Frontend API** in `js/api.js`

## Migration Phases

| Phase | Feature | Status |
|-------|---------|--------|
| 0 | Infrastructure | Complete |
| 1 | Q&A + Phrases + Tags | Backend done, frontend pending |
| 2 | Phrases Library | Pending |
| 3 | TTS (ElevenLabs) | Pending |
| 4 | SRS Practice | Pending |
| 5 | Authentication | Pending |
| 6 | Polish (STT, PWA) | Pending |

**Language model:** Source language (native) → Target language (learning). Multi-target supported.

**Note:** Auth deferred to Phase 5. Using `DEV_USER_ID` pattern until then.

## Reference

- `web/DESIGN.md` - Architecture, PostgreSQL schema, API endpoints
- `web/MIGRATION.md` - Detailed migration plan per feature
- `web/INFRASTRUCTURE.md` - Cloud costs, Terraform setup, CI/CD
- `web/CLAUDE.md` - Development patterns and guidelines
- `src-tauri/src/commands/` - Desktop code to port (reference only)
