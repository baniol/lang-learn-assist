# Testing Plan

This document outlines the testing strategy for the Lang Learn Assist application, covering both frontend (React/TypeScript) and backend (Rust) layers.

## Overview

The application is a Tauri desktop app with:
- **Frontend**: React + TypeScript (UI, state management, hooks)
- **Backend**: Rust (database, LLM integration, audio processing, SRS algorithm)

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
│   SRS algorithm       │   Custom hooks                  │
│   Answer validation   │   Utilities                     │
│   Data models         │   Type guards                   │
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
| `usePracticeSession` | Session lifecycle, retry mode transitions, phrase limits, new phrase counting, state restoration | High |
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

#### Priority 1: SRS Algorithm

Location: `src-tauri/src/learning.rs`

| Function | Test Cases |
|----------|------------|
| `calculate_next_review()` | Correct answer increases interval, incorrect resets, ease factor bounds |
| `select_next_phrase()` | Due phrases prioritized, new phrase limits respected, exclusions honored |
| `is_phrase_learned()` | Streak threshold logic |

#### Priority 2: Answer Validation

Location: `src-tauri/src/commands/learning.rs`

| Function | Test Cases |
|----------|------------|
| `validate_answer()` | Exact match, accepted alternatives, fuzzy matching, case insensitivity, punctuation handling |

#### Priority 3: Data Models

Location: `src-tauri/src/models.rs`

| Model | Test Cases |
|-------|------------|
| `SessionState` | Serialization/deserialization, default values |
| `PhraseProgress` | SRS field calculations |

### Example Test Structure

```rust
// src-tauri/src/learning.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_next_review_correct_answer() {
        let progress = PhraseProgress {
            ease_factor: 2.5,
            interval_days: 1,
            correct_streak: 1,
            ..Default::default()
        };

        let updated = calculate_next_review(&progress, true);

        assert!(updated.interval_days > 1);
        assert!(updated.ease_factor >= 2.5);
        assert_eq!(updated.correct_streak, 2);
    }

    #[test]
    fn test_calculate_next_review_incorrect_resets_streak() {
        let progress = PhraseProgress {
            correct_streak: 5,
            interval_days: 10,
            ..Default::default()
        };

        let updated = calculate_next_review(&progress, false);

        assert_eq!(updated.correct_streak, 0);
        assert_eq!(updated.interval_days, 1);
    }

    #[test]
    fn test_ease_factor_has_minimum_bound() {
        // Repeated failures shouldn't push ease_factor below MIN_EASE_FACTOR
    }
}
```

---

## 3. Backend Integration Tests (Rust)

### What to Test

Test Tauri commands with real SQLite database (in-memory or temp file).

| Command Group | Test Cases |
|---------------|------------|
| Conversation CRUD | Create, update, finalize, delete cascade |
| Phrase CRUD | Create batch, toggle starred/excluded, update |
| Practice Session | Start, record answers, finish, restore state |
| Learning Flow | Full session with multiple phrases, streak tracking |

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
fn test_practice_session_full_flow() {
    let (_dir, conn) = setup_test_db();

    // Create phrases
    // Start session
    // Record answers
    // Verify SRS updates
    // Finish session
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
| **Conversation Flow** | Create conversation → Send messages → Review → Extract phrases → Save | Phrases appear in library |
| **Practice Session** | Start session → Answer correctly → Answer incorrectly → Retry → Complete | Stats updated, SRS intervals correct |
| **Phrase Management** | Add phrase → Star → Exclude → Delete | Library state correct |
| **Settings** | Change language → Verify persisted | New conversations use new language |
| **Audio Playback** | Play phrase → Stop → Play all | No crashes, correct sequencing |

### Test Structure

```
e2e/
├── fixtures/
│   └── test-data.sql           # Seed data for tests
├── pages/
│   ├── dashboard.page.ts       # Page objects
│   ├── conversation.page.ts
│   └── learn.page.ts
├── specs/
│   ├── conversation.spec.ts
│   ├── practice-session.spec.ts
│   └── phrase-management.spec.ts
└── support/
    └── tauri-commands.ts       # Helper to invoke Tauri commands directly
```

### Example E2E Test

```typescript
// e2e/specs/practice-session.spec.ts
describe('Practice Session', () => {
  beforeEach(async () => {
    // Seed database with test phrases
    await tauriInvoke('reset_test_database');
    await tauriInvoke('seed_test_phrases', { count: 5 });
  });

  it('should complete a full practice session', async () => {
    // Navigate to Learn
    await DashboardPage.navigateTo('learn');

    // Start session
    await LearnPage.selectMode('typing');
    await LearnPage.startSession();

    // Answer first phrase correctly
    const prompt = await LearnPage.getPrompt();
    await LearnPage.typeAnswer('correct answer');
    await LearnPage.submit();
    expect(await LearnPage.getFeedback()).toBe('correct');

    // Proceed through session...

    // Verify completion
    expect(await LearnPage.isSessionComplete()).toBe(true);
    expect(await LearnPage.getCorrectCount()).toBeGreaterThan(0);
  });

  it('should handle incorrect answers with retry mode', async () => {
    // ...
  });
});
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Set up Vitest with React Testing Library
- [ ] Create test utilities and mocks for Tauri
- [ ] Write tests for `useQuery` and `useMutation` hooks
- [ ] Write tests for `lib/utils.ts`

### Phase 2: Core Hook Tests (Week 2)
- [ ] Tests for `usePracticeSession` (highest complexity)
- [ ] Tests for `useConversation`
- [ ] Tests for `useAudioPlayback`
- [ ] Tests for navigation utilities

### Phase 3: Rust Unit Tests (Week 2-3)
- [ ] SRS algorithm tests
- [ ] Answer validation tests
- [ ] Model serialization tests

### Phase 4: Rust Integration Tests (Week 3)
- [ ] Database CRUD tests
- [ ] Practice session flow tests
- [ ] Command integration tests

### Phase 5: E2E Setup (Week 4)
- [ ] Set up WebdriverIO/Playwright with Tauri
- [ ] Create page objects
- [ ] Write 3-5 critical path tests

### Phase 6: CI Integration (Week 4)
- [ ] Run unit tests on PR
- [ ] Run integration tests on PR
- [ ] Run E2E tests on merge to main (slower)

---

## 6. Test Commands

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

# E2E tests
test-e2e:
	npm run test:e2e

# All tests
test-all: test-frontend test-rust test-integration
```

---

## 7. Coverage Goals

| Layer | Target | Rationale |
|-------|--------|-----------|
| Custom Hooks | 80%+ | Core logic lives here |
| Rust SRS/Validation | 90%+ | Critical correctness |
| Rust Commands | 60%+ | Integration-tested |
| E2E Critical Paths | 100% | Must not regress |
| UI Components | 0% | Low value, high churn |

---

## 8. Files to Create

```
lang-learn-assist/
├── vitest.config.ts                    # Vitest configuration
├── src/
│   ├── test/
│   │   ├── setup.ts                    # Test setup, global mocks
│   │   └── test-utils.tsx              # Custom render, providers
│   ├── hooks/
│   │   ├── useQuery.test.ts
│   │   ├── useMutation.test.ts
│   │   ├── usePracticeSession.test.ts
│   │   ├── useConversation.test.ts
│   │   └── useAudioPlayback.test.ts
│   └── lib/
│       └── utils.test.ts
├── src-tauri/
│   └── src/
│       ├── learning.rs                 # Add #[cfg(test)] mod tests
│       └── commands/
│           └── learning.rs             # Add #[cfg(test)] mod tests
├── e2e/
│   ├── wdio.conf.ts                    # WebdriverIO config
│   ├── pages/                          # Page objects
│   └── specs/                          # Test specs
└── package.json                        # Add test scripts
```

---

## 9. Success Criteria

1. **All unit tests pass** in CI before merge
2. **No regressions** in SRS algorithm (critical for learning app)
3. **E2E tests catch** breaking changes in user flows
4. **Test suite runs** in < 2 minutes (unit + integration)
5. **E2E suite runs** in < 10 minutes

---

## Next Steps

1. Review and approve this plan
2. Start with Phase 1: Vitest setup + hook tests
3. Iterate based on bugs found and coverage gaps
