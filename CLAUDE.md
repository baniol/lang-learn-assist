# CLAUDE.md

Tauri desktop app: React/TypeScript frontend + Rust backend. Language learning with AI conversations, phrase management, and learning materials.

## Commands
```bash
make dev          # Run development
make build        # Production build
make check-all    # Lint + format-check + type-check + all tests (pre-commit)
make type-check   # TypeScript check
make lint         # ESLint
make format       # Prettier format
make test-rust    # Rust tests
npm test          # Run frontend tests (Vitest)
```

## Changelog & Versioning

- **After each feature commit:** update `## [Unreleased]` in `CHANGELOG.md` (Added/Changed/Fixed/Removed)
- **Releasing:** `make bump-patch` (or `bump-minor`/`bump-major`) → `git push && git push --tags`
  - Updates `package.json`, `Cargo.toml`, `CHANGELOG.md`, creates commit + tag
  - `tauri.conf.json` reads version from `package.json` automatically

## Pre-commit Hook

The pre-commit hook runs `make check-all` before every commit.
Setup once: `make setup-hooks` (or `make install`)

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
2. Add migration for existing DBs
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

## Frontend Development Standards

### Hook Development

**Structure:** All hooks should follow this pattern:
```tsx
export function useFeature(deps: FeatureDeps) {
  // 1. State declarations
  const [data, setData] = useState<Type | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2. Refs for cleanup and stale closure prevention
  const mountedRef = useRef(true);
  const currentRequestRef = useRef(0);

  // 3. Callbacks with proper dependencies
  const fetchData = useCallback(async () => {
    const requestId = ++currentRequestRef.current;
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall();
      // Check if still mounted and request is still current
      if (mountedRef.current && requestId === currentRequestRef.current) {
        setData(result);
      }
    } catch (err) {
      if (mountedRef.current && requestId === currentRequestRef.current) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      if (mountedRef.current && requestId === currentRequestRef.current) {
        setLoading(false);
      }
    }
  }, [/* stable deps only */]);

  // 4. Effects with cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // 5. Return object (not array for named access)
  return { data, loading, error, fetchData };
}
```

**Required patterns:**
- Use `mountedRef` to prevent state updates after unmount
- Use `currentRequestRef` to handle race conditions in async operations
- Always return loading, error, and data states
- Use `useCallback` for functions returned to consumers
- Clean up subscriptions, timers, and listeners in effect cleanup

### Component Development

**File structure:**
```tsx
// 1. Imports (external, then internal, then types)
import { useState, useCallback } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { Button } from "../components/ui";
import type { ComponentProps } from "../types";

// 2. Types/interfaces (if not in types/index.ts)
interface Props {
  onAction: (id: string) => void;
  initialValue?: string;
}

// 3. Component definition
export function ComponentName({ onAction, initialValue = "" }: Props) {
  // hooks first
  const { settings } = useSettings();
  const [value, setValue] = useState(initialValue);

  // handlers
  const handleClick = useCallback(() => {
    onAction(value);
  }, [onAction, value]);

  // render
  return (
    <div className="component-wrapper">
      {/* JSX */}
    </div>
  );
}
```

**Props naming:**
- Event handlers: `onAction`, `onChange`, `onSubmit` (on + verb)
- Boolean flags: `isActive`, `hasError`, `canEdit` (is/has/can + adjective)
- Render functions: `renderItem`, `renderHeader` (render + noun)

### API Layer

**Tauri command wrappers in `src/lib/`:**
```tsx
import { invoke } from "@tauri-apps/api/core";
import type { Phrase } from "../types";

export async function getPhrases(conversationId: number): Promise<Phrase[]> {
  return invoke<Phrase[]>("get_phrases", { conversationId });
}

// For commands that can fail, handle errors at call site:
export async function deletePhrase(phraseId: number): Promise<void> {
  return invoke("delete_phrase", { phraseId });
}
```

**Error handling at call site:**
```tsx
try {
  await deletePhrase(id);
  showSuccess("Phrase deleted");
} catch (err) {
  showError(err instanceof Error ? err.message : "Failed to delete phrase");
}
```

### Testing

**When to write tests:**
- All hooks with async logic or complex state
- Utility functions with business logic
- Components with user interactions
- API wrappers with error handling

**Test file location:** `src/__tests__/{feature}.test.ts(x)`

**Test structure:**
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFeature } from "../hooks/useFeature";

// Mock Tauri
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("useFeature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load data on mount", async () => {
    const mockData = [{ id: 1 }];
    vi.mocked(invoke).mockResolvedValue(mockData);

    const { result } = renderHook(() => useFeature());

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
  });

  it("should handle errors", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("API Error"));

    const { result } = renderHook(() => useFeature());

    await waitFor(() => {
      expect(result.current.error).toBe("API Error");
    });
  });
});
```

### State Management

**Use local state (`useState`) for:**
- UI state (open/closed, selected item, form values)
- Component-specific data that doesn't need sharing

**Use context for:**
- App-wide settings (theme, language)
- User authentication state
- Data that multiple unrelated components need

**Use refs (`useRef`) for:**
- Values that shouldn't trigger re-renders
- Mutable values across renders (mounted flag, request IDs)
- DOM element references
- Previous value tracking

### Error Handling

**Async operations:**
```tsx
const [error, setError] = useState<string | null>(null);

const handleAction = async () => {
  setError(null);
  try {
    await asyncOperation();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Operation failed");
  }
};
```

**Display errors:**
```tsx
{error && (
  <div className="text-red-500 text-sm mt-2">{error}</div>
)}
```

### Anti-patterns to Avoid

**DON'T: Update state after unmount**
```tsx
// BAD
useEffect(() => {
  fetchData().then(setData);
}, []);

// GOOD
useEffect(() => {
  let mounted = true;
  fetchData().then(data => {
    if (mounted) setData(data);
  });
  return () => { mounted = false; };
}, []);
```

**DON'T: Create stale closures**
```tsx
// BAD - callback captures stale state
const callback = () => {
  console.log(count); // Always logs initial value
};

// GOOD - use ref for latest value
const countRef = useRef(count);
countRef.current = count;
const callback = () => {
  console.log(countRef.current);
};
```

**DON'T: Race conditions in async**
```tsx
// BAD - rapid calls cause out-of-order updates
const search = async (query: string) => {
  const results = await fetchResults(query);
  setResults(results); // Old query might finish after new one
};

// GOOD - track request identity
const requestRef = useRef(0);
const search = async (query: string) => {
  const id = ++requestRef.current;
  const results = await fetchResults(query);
  if (id === requestRef.current) {
    setResults(results);
  }
};
```

**DON'T: Inline SVGs**
```tsx
// BAD
<svg viewBox="0 0 24 24">...</svg>

// GOOD
import { PlusIcon } from "../components/icons";
<PlusIcon size="md" />
```

**DON'T: Prop drilling through many layers**
```tsx
// BAD
<Parent settings={settings}>
  <Child settings={settings}>
    <GrandChild settings={settings} />

// GOOD - use context
const { settings } = useSettings();
```

## Backend Development Standards

### Module Organization

**File size limits:** Split files exceeding ~300 lines into submodules
```
src/commands/llm.rs (1000 lines) → src/commands/llm/
├── mod.rs          # Re-exports public items
├── client.rs       # HTTP client
├── prompts.rs      # Prompt templates
├── phrase.rs       # Phrase refinement
├── translation.rs  # Translation logic
└── material.rs     # Material processing
```

**When to create submodules:**
- File exceeds 300 lines
- Clear functional boundaries exist
- Multiple developers work on same file
- Testing requires isolation

### Tauri Command Structure

**Basic command:**
```rust
#[tauri::command]
pub fn get_phrase(id: i64) -> Result<Phrase, String> {
    let conn = get_conn()?;
    // ... implementation
}
```

**Command with state:**
```rust
#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = state.settings.safe_read()?;
    Ok(settings.clone())
}
```

**Async command:**
```rust
#[tauri::command]
pub async fn send_message(
    state: State<'_, AppState>,
    message: String,
) -> Result<LlmResponse, String> {
    let settings = state.settings.safe_read()?.clone();
    // ... async implementation
}
```

**Parameter naming:** Use camelCase in Rust (auto-converts from TypeScript)
```rust
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_phrases(
    conversationId: Option<i64>,  // camelCase for Tauri
    targetLanguage: Option<String>,
) -> Result<Vec<Phrase>, String> { ... }
```

### Error Handling

**Return `Result<T, String>` for Tauri commands:**
```rust
pub fn do_something() -> Result<Data, String> {
    let conn = get_conn()?;  // Uses ? with map_err

    conn.execute("...", params![...])
        .map_err(|e| format!("Failed to execute: {}", e))?;

    Ok(data)
}
```

**Use safe lock wrappers (never bare `.unwrap()` on locks):**
```rust
use crate::utils::lock::{SafeLock, SafeRwLock};

// BAD - can panic if lock is poisoned
let guard = mutex.lock().unwrap();

// GOOD - returns Result
let guard = mutex.safe_lock()?;
let guard = rwlock.safe_read()?;
let guard = rwlock.safe_write()?;
```

### Database Operations

**Get connection:**
```rust
use crate::db::get_conn;

let conn = get_conn()?;  // Returns Result<Connection, String>
```

**Use shared row mappers:**
```rust
use crate::utils::db::{row_to_phrase, row_to_phrase_with_progress};

let phrases = stmt
    .query_map(params, row_to_phrase_with_progress)
    .map_err(|e| format!("Query failed: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Collection failed: {}", e))?;
```

**Migrations:** Always add migrations for new columns
```rust
// In db.rs init_db()
if !columns.contains(&"new_column".to_string()) {
    log_migration_result(
        "add new_column to table",
        conn.execute("ALTER TABLE t ADD COLUMN new_column TYPE DEFAULT value", []),
    );
}
```

### State Management

**Use RwLock for read-heavy data (settings):**
```rust
pub struct AppState {
    pub settings: RwLock<AppSettings>,  // Many readers, rare writes
}

// Reading (allows concurrent access)
let settings = state.settings.safe_read()?;

// Writing (exclusive access)
let mut settings = state.settings.safe_write()?;
```

**Use Mutex for write-heavy or complex state:**
```rust
pub struct AppState {
    pub whisper_model: Mutex<Option<WhisperContext>>,
}

let mut model = state.whisper_model.safe_lock()?;
```

### Constants

**Centralize magic numbers in `src/constants.rs`:**
```rust
pub mod llm {
    pub const REFINE_PHRASE_MAX_TOKENS: i64 = 1000;
    pub const REQUEST_TIMEOUT_SECS: u64 = 60;
}

pub mod tokens {
    pub const CHARS_PER_TOKEN_GERMAN: usize = 3;
}
```

**Usage:**
```rust
use crate::constants::llm::REQUEST_TIMEOUT_SECS;
```

### Testing

**Test file location:** Add `#[cfg(test)]` module at end of file
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_something() {
        assert_eq!(calculate(1, 2), 3);
    }
}
```

**Database tests with in-memory SQLite:**
```rust
use crate::db::init_db;
use rusqlite::Connection;

fn setup_test_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    init_db(&conn).unwrap();
    conn
}

#[test]
fn test_with_db() {
    let conn = setup_test_db();
    // ... test using conn
}
```

**What to test:**
- Pure functions (algorithms, calculations)
- Data transformations (row mappers, serialization)
- Business logic (data transformations, answer matching)
- Import/export (data integrity)

**What NOT to test:**
- Simple CRUD (just SQL, low bug risk)
- External API calls (mock at integration level)
- Tauri framework behavior

### Anti-patterns to Avoid

**DON'T: Bare unwrap on locks**
```rust
// BAD - panics on poisoned lock
let guard = mutex.lock().unwrap();

// GOOD
let guard = mutex.safe_lock()?;
```

**DON'T: Silent error swallowing**
```rust
// BAD
conn.execute("...", []).ok();

// GOOD
log_migration_result("migration_name", conn.execute("...", []));
```

**DON'T: Hardcoded magic numbers**
```rust
// BAD
if timeout > 60 { ... }

// GOOD
use crate::constants::llm::REQUEST_TIMEOUT_SECS;
if timeout > REQUEST_TIMEOUT_SECS { ... }
```

**DON'T: Monolithic files**
```rust
// BAD - 1000+ line file with mixed concerns

// GOOD - split into focused modules
mod client;       // HTTP client
mod prompts;      // Prompt templates
mod translation;  // Translation logic
```

## General Development Rules

### Code Quality

- **Read before writing:** Always read existing files to understand patterns
- **Minimal changes:** Only modify what's necessary for the task
- **No over-engineering:** Avoid abstractions until needed twice
- **Self-documenting code:** Clear names over comments

### Architecture

- **Frontend:** React handles UI state, Tauri commands fetch data
- **Backend:** Rust handles business logic, SQLite stores data
- **No router:** Navigation via `onNavigate(view, data)` state pattern
- **No global state library:** Context for settings, local state for UI

### Testing Requirements

- **Before PR:** `make type-check && make test-rust && npm test`
- **New algorithms:** Must have unit tests
- **Data operations:** Test roundtrip (export → import → export)
- **Bug fixes:** Add regression test when practical

**Auto-infer test needs:** When implementing code that matches these criteria, write tests without being asked:
- New hooks with async logic or complex state
- New utility functions with business logic
- New algorithms or calculations (frontend or backend)
- Data transformation functions
- Import/export operations

For simple CRUD, UI-only changes, or navigation logic - tests are optional unless explicitly requested.

### Commits

- **Atomic commits:** One logical change per commit
- **Run checks:** Build and test before committing
- **Message format:** Imperative mood, explain why not what

### File Organization

```
src/                    # Frontend (React/TypeScript)
├── components/         # Reusable UI components
├── views/              # Page-level components
├── hooks/              # Custom React hooks
├── lib/                # Tauri command wrappers
├── contexts/           # React contexts
├── types/              # TypeScript interfaces
└── __tests__/          # Frontend tests

src-tauri/src/          # Backend (Rust)
├── commands/           # Tauri command handlers
│   └── llm/            # Split module example
├── utils/              # Shared utilities
├── constants.rs        # Magic numbers
├── db.rs               # Database schema & migrations
├── models.rs           # Data structures
├── state.rs            # App state definition
└── lib.rs              # App entry point
```

## IMPORTANT

- ALWAYS read existing files before modifying - understand patterns first
- New DB columns MUST include migration for existing databases
- Tauri command params use camelCase in TypeScript, snake_case in Rust
- Test with `make type-check` and `cargo build` before considering done
- Keep components self-contained - avoid prop drilling, use Tauri commands for data
- See `REFACTORING_GUIDE.md` for ongoing refactoring work and progress

## Reference

**Documentation:**
- `DOCUMENTATION.md` - User-facing feature docs
- `REFACTORING_GUIDE.md` - Frontend refactoring plan and progress

**Backend:**
- `src-tauri/src/db.rs` - Database schema and migrations
- `src-tauri/src/models.rs` - All Rust data structures
- `src-tauri/src/constants.rs` - Centralized constants
- `src-tauri/src/utils/` - Shared utilities (lock, db, error, regex)
- `src-tauri/src/commands/data_export.rs` - Import/export with tests

**Frontend:**
- `src/types/index.ts` - All TypeScript interfaces
- `src/lib/` - Tauri command wrappers
- `src/__tests__/` - Frontend test examples and patterns
