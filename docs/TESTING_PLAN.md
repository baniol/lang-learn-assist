# Testing Plan

This document outlines the testing strategy for the Lang Learn Assist application, covering both frontend (React/TypeScript) and backend (Rust) layers.

## Overview

The application is a Tauri desktop app with:
- **Frontend**: React + TypeScript (UI, state management, hooks)
- **Backend**: Rust (database, LLM integration, audio processing)

Testing strategy prioritizes **high-value tests** that catch real bugs without excessive mocking overhead.

---

## Testing Layers

```
┌─────────────────────────────────────────────────────────┐
│                    E2E Tests (Tauri)                    │
│         Full user flows, real DB, real IPC              │
├─────────────────────────────────────────────────────────┤
│              Integration Tests (Rust)                   │
│        Commands + DB, LLM mocked                        │
├───────────────────────┬─────────────────────────────────┤
│   Unit Tests (Rust)   │   Unit Tests (TypeScript)       │
│   Answer validation   │   Custom hooks                  │
│   Data models         │   Utilities                     │
│   Import/export       │   Type guards                   │
└───────────────────────┴─────────────────────────────────┘
```

---

## 1. Frontend Unit Tests

### Tools
- **Vitest** - Fast, Vite-native test runner
- **@testing-library/react** - Hook and component testing
- **msw** (optional) - Mock Tauri invoke if needed

### What to Test

#### Priority 1: Custom Hooks with Logic

| Hook | Test Cases | Complexity |
|------|------------|------------|
| `useQuery` | Loading states, error handling, refetch, enabled flag, cleanup on unmount | Medium |
| `useMutation` | Optimistic updates, rollback on error, loading states | Medium |
| `useConversation` | Message parsing, send/delete flow, title generation trigger | Medium |
| `useAudioPlayback` | Cache eviction, playback queue, stop behavior | Medium |
| `useVoiceRecording` | Status transitions, space key handling, cleanup | Medium |
| `useNavigation` | View state creation, type guards | Low |

#### Priority 2: Utility Functions

| File | Functions | Test Cases |
|------|-----------|------------|
| `lib/utils.ts` | `cn()`, `formatDate()`, `truncate()`, `debounce()` | Edge cases, null handling |
| `hooks/useConversation.ts` | `parseMessages()` | Invalid JSON, malformed messages, empty arrays |
| `types/navigation.ts` | `isConversationView()`, `createViewState()` | Type discrimination, data validation |

#### Priority 3: Skip

- Presentational components (Button, Badge, Card, Dialog)
- View components (too coupled to backend)
- Icon components
- Context providers (tested via hooks)

### Example Test Structure

```
src/
├── hooks/
│   ├── useQuery.ts
│   ├── useQuery.test.ts        # Co-located tests
│   ├── useMutation.ts
│   ├── useMutation.test.ts
│   └── ...
├── lib/
│   ├── utils.ts
│   └── utils.test.ts
└── test/
    └── setup.ts                 # Vitest setup, mocks
```

### Mocking Strategy

```typescript
// Mock Tauri invoke for hook tests
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

// Example: testing useQuery
describe('useQuery', () => {
  it('should handle loading state correctly', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: 'test' });
    const { result } = renderHook(() => useQuery(mockFn, []));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ data: 'test' });
  });

  it('should not update state after unmount', async () => {
    // Test memory leak prevention
  });

  it('should refetch when deps change', async () => {
    // Test dependency tracking
  });
});
```

---

## 2. Backend Unit Tests (Rust)

### Tools
- Built-in `cargo test`
- `mockall` for mocking traits (LLM, TTS providers)

### What to Test

#### Priority 1: Data Import/Export

Location: `src-tauri/src/commands/data_export.rs`

| Function | Test Cases |
|----------|------------|
| `export_data()` | Full export roundtrip, all data types included |
| `import_data()` | Merge mode, overwrite mode, legacy field handling |
| Legacy compatibility | Importing old exports with removed fields (decks, SRS) |

#### Priority 2: Answer Validation

| Function | Test Cases |
|----------|------------|
| `validate_answer()` | Exact match, accepted alternatives, fuzzy matching, case insensitivity, punctuation handling |

#### Priority 3: Data Models

Location: `src-tauri/src/models.rs`

| Model | Test Cases |
|-------|------------|
| `ExportData` | Serialization/deserialization, default values |
| `Phrase` | Field mapping, row conversion |

---

## 3. Backend Integration Tests (Rust)

### What to Test

Test Tauri commands with real SQLite database (in-memory or temp file).

| Command Group | Test Cases |
|---------------|------------|
| Phrase CRUD | Create batch, toggle starred, update |
| Materials | Create, process, extract phrases |
| Questions | Create thread, add messages |
| Settings | Save, load, export/import |

### Setup

```rust
// tests/integration_test.rs
use tempfile::TempDir;

fn setup_test_db() -> (TempDir, SqliteConnection) {
    let dir = TempDir::new().unwrap();
    let db_path = dir.path().join("test.db");
    let conn = establish_connection(&db_path).unwrap();
    run_migrations(&conn).unwrap();
    (dir, conn)
}

#[test]
fn test_phrase_crud_flow() {
    let (_dir, conn) = setup_test_db();

    // Create phrases
    // Update phrases
    // Verify state
}
```

---

## 4. E2E Tests

### Tools
- **WebdriverIO** + Tauri driver, OR
- **Playwright** (experimental Tauri support)

### What to Test

Focus on critical user journeys that span frontend + backend:

| Flow | Steps | Assertions |
|------|-------|------------|
| **Phrase Management** | Add phrase → Star → Delete | Library state correct |
| **Materials Flow** | Create material → Process → Extract phrases | Phrases appear in library |
| **Settings** | Change language → Verify persisted | New conversations use new language |
| **Audio Playback** | Play phrase → Stop → Play all | No crashes, correct sequencing |
| **Data Export/Import** | Export → Import (merge) → Verify | All data preserved |

---

## 5. Test Commands

Add to `Makefile`:

```makefile
# Frontend tests
test-frontend:
	npm run test

test-frontend-watch:
	npm run test:watch

test-frontend-coverage:
	npm run test:coverage

# Backend tests
test-rust:
	cd src-tauri && cargo test

test-rust-verbose:
	cd src-tauri && cargo test -- --nocapture

# Integration tests
test-integration:
	cd src-tauri && cargo test --test '*'

# All tests
test-all: test-frontend test-rust test-integration
```

---

## 6. Coverage Goals

| Layer | Target | Rationale |
|-------|--------|-----------|
| Custom Hooks | 80%+ | Core logic lives here |
| Rust Import/Export | 90%+ | Critical data integrity |
| Rust Commands | 60%+ | Integration-tested |
| E2E Critical Paths | 100% | Must not regress |
| UI Components | 0% | Low value, high churn |

---

## 7. Success Criteria

1. **All unit tests pass** in CI before merge
2. **No regressions** in data import/export (critical for user data)
3. **E2E tests catch** breaking changes in user flows
4. **Test suite runs** in < 2 minutes (unit + integration)
