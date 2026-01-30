# CLAUDE.md

Tauri desktop app: React/TypeScript frontend + Rust backend. Language learning with AI conversations, phrase extraction, and SRS practice.

## Commands
```bash
make dev          # Run development
make build        # Production build
make type-check   # TypeScript check
make test-rust    # Rust tests
```

## Adding Features

**New Tauri command:**
1. Add function in `src-tauri/src/commands/{domain}.rs`
2. Register in `src-tauri/src/lib.rs` invoke_handler
3. Add TypeScript wrapper in `src/lib/{domain}.ts`
4. Add types in `src/types/index.ts`

**New view:**
1. Create `src/views/{Name}View.tsx`
2. Add to `ViewType` union in `src/types/index.ts`
3. Add case in `src/App.tsx` renderView switch

**New component:** Create in `src/components/` - no registration needed

**Database changes:**
1. Update schema in `src-tauri/src/db.rs`
2. Add migration for existing DBs (see `phrase_progress` SRS fields example)
3. Update models in `src-tauri/src/models.rs`

## Patterns

**Navigation:** State-based via `onNavigate(view: ViewType, data?: unknown)` - no router library

**Tauri commands:** Use `#[tauri::command]` + camelCase params (Rust snake_case auto-converts)

**Frontend state:** Local useState per view, invoke Tauri commands directly

**SRS algorithm:** Located in `learning.rs` - simplified SM-2 with ease_factor, interval_days, next_review_at

## IMPORTANT

- ALWAYS read existing files before modifying - understand patterns first
- New DB columns MUST include migration for existing databases
- Tauri command params use camelCase in TypeScript, snake_case in Rust
- Test with `make type-check` and `cargo build` before considering done
- Keep components self-contained - avoid prop drilling, use Tauri commands for data

## Reference
- `DOCUMENTATION.md` - User-facing feature docs
- `src-tauri/src/db.rs` - Database schema and migrations
- `src-tauri/src/models.rs` - All Rust data structures
- `src/types/index.ts` - All TypeScript interfaces
