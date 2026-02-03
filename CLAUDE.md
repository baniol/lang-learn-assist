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

## Frontend Conventions

**Icons:** Use centralized icons from `src/components/icons/` - NEVER add inline SVGs
```tsx
import { PlusIcon, CloseIcon } from "../components/icons";
<PlusIcon size="md" className="text-blue-500" />
```

**UI Components:** Use primitives from `src/components/ui/` for consistency
```tsx
import { Button, Dialog, Input, Badge } from "../components/ui";
```

**Class names:** Use `cn()` utility for conditional classes
```tsx
import { cn } from "../lib/utils";
<div className={cn("base-class", isActive && "active-class")} />
```

**Settings:** Use `useSettings()` hook from context (not props)
```tsx
import { useSettings } from "../contexts/SettingsContext";
const { settings, updateSettings } = useSettings();
```

## Backend Patterns

**Navigation:** State-based via `onNavigate(view: ViewType, data?: unknown)` - no router library

**Tauri commands:** Use `#[tauri::command]` + camelCase params (Rust snake_case auto-converts)

**SRS algorithm:** Located in `learning.rs` - simplified SM-2 with ease_factor, interval_days, next_review_at

## IMPORTANT

- ALWAYS read existing files before modifying - understand patterns first
- New DB columns MUST include migration for existing databases
- Tauri command params use camelCase in TypeScript, snake_case in Rust
- Test with `make type-check` and `cargo build` before considering done
- Keep components self-contained - avoid prop drilling, use Tauri commands for data
- See `REFACTORING_GUIDE.md` for ongoing refactoring work and progress

## Reference
- `DOCUMENTATION.md` - User-facing feature docs
- `REFACTORING_GUIDE.md` - Frontend refactoring plan and progress
- `src-tauri/src/db.rs` - Database schema and migrations
- `src-tauri/src/models.rs` - All Rust data structures
- `src/types/index.ts` - All TypeScript interfaces
