# Frontend Tests

This document describes the frontend test suite for the Lang Learn Assist application.

## Overview

The frontend tests use **Vitest** with **React Testing Library** to test custom hooks, utilities, and type guards. Tests are co-located with their source files.

## Running Tests

```bash
# Run all tests once
make test
# or
npm run test

# Run tests in watch mode (during development)
make test-watch
# or
npm run test:watch

# Run tests with coverage report
make test-coverage
# or
npm run test:coverage

# Run all tests (frontend + Rust backend)
make test-all
```

## Test Structure

```
src/
├── test/
│   ├── setup.ts              # Global test setup and mocks
│   └── test-utils.tsx        # Custom render utilities
├── hooks/
│   ├── useQuery.test.ts      # 21 tests
│   ├── useMutation.test.ts   # 18 tests
│   ├── useConversation.test.ts   # 27 tests
│   ├── useAudioPlayback.test.ts  # 11 tests
│   └── useNavigation.test.ts     # 21 tests
├── lib/
│   └── utils.test.ts         # 27 tests
└── types/
    └── navigation.test.ts    # 39 tests
```

## Test Categories

### 1. Custom Hooks

#### `useQuery` (21 tests)
Data fetching hook with loading and error states.

| Category | Test Cases |
|----------|------------|
| Basic functionality | Loading state, data fetching, error handling |
| `enabled` option | Conditional fetching, enabling on change |
| Dependencies | Refetch on dependency change |
| `initialData` option | Pre-populated data before fetch |
| Callbacks | `onSuccess`, `onError` handlers |
| `refetch` | Manual refetch trigger |
| `reset` | State reset to initial values |
| Unmount | No state updates after unmount |

#### `useMutation` (18 tests)
Mutation hook for create/update/delete operations.

| Category | Test Cases |
|----------|------------|
| Initial state | Idle state verification |
| `mutate` | Fire-and-forget mutations, state updates |
| `mutateAsync` | Promise-based mutations, error throwing |
| Callbacks | `onSuccess`, `onError`, `onSettled` |
| `reset` | State reset |
| Unmount | No state updates after unmount |
| Optimistic updates | `onMutate` context, rollback on error |

#### `useConversation` (27 tests)
Conversation message management hook.

| Category | Test Cases |
|----------|------------|
| `parseMessages` | JSON parsing, validation, filtering invalid messages |
| Initial state | Empty messages, no auto-load |
| `loadMessages` | Load from conversation, clear on null |
| `sendMessage` | Optimistic updates, API calls, error revert |
| Loading state | Loading indicator during send |
| Title generation | Auto-generate after first exchange |
| `deleteMessage` | Delete pairs (user+assistant), cascade |
| `clearError` | Error state reset |

#### `useAudioPlayback` (11 tests)
Audio playback with TTS integration.

| Category | Test Cases |
|----------|------------|
| Initial state | Idle state verification |
| `playMessage` | TTS API calls, state updates, error handling |
| Caching | Audio file caching, cache reuse |
| `stop` | Playback stop, state reset |
| `playAll` | Filter assistant messages, sequential play |
| Voice options | Per-language voices, explicit voice selection |

#### `useNavigation` (21 tests)
Type-safe view navigation hook.

| Category | Test Cases |
|----------|------------|
| Initial state | Default dashboard, custom initial view |
| Navigate (no data) | All views without data requirements |
| Navigate (with data) | conversation, conversation-review, material-review |
| `activeNavItem` | Sub-view to parent mapping |
| Navigation history | Sequential navigation updates |

### 2. Utility Functions

#### `lib/utils.ts` (27 tests)

| Function | Test Cases |
|----------|------------|
| `cn()` | Class merging, conditionals, Tailwind conflict resolution |
| `formatDate()` | String/Date input, custom options, ISO strings |
| `formatRelativeTime()` | Today, Yesterday, days ago, weeks ago, fallback |
| `truncate()` | No truncation, truncation with ellipsis, edge cases |
| `debounce()` | Delay, timer reset, argument passing, independence |

### 3. Type Guards & Utilities

#### `types/navigation.ts` (39 tests)

| Function | Test Cases |
|----------|------------|
| `createViewState()` | All views without data, all views with data |
| `isConversationView()` | Type narrowing, false for other views |
| `isConversationReviewView()` | Type narrowing, false for other views |
| `isMaterialReviewView()` | Type narrowing, false for other views |
| `viewRequiresData()` | Data-requiring views, views without data |
| `getParentView()` | Sub-view parents, null for top-level |
| `isSubViewOf()` | Correct parent relationships |
| `getActiveNavItem()` | Sub-view to nav item mapping |

## Mocking Strategy

### Tauri API
```typescript
// src/test/setup.ts
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
```

### Audio API
```typescript
// Mock Audio constructor in beforeEach
class MockAudioClass {
  onended: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
}
globalThis.Audio = MockAudioClass as unknown as typeof Audio;
```

### TTS Module
```typescript
vi.mock("../lib/tts", () => ({
  generateTts: vi.fn(),
  getAudioBase64: vi.fn(),
  getVoiceForLanguage: vi.fn(),
}));
```

### LLM/API Modules
```typescript
vi.mock("../lib/llm", () => ({
  sendConversationMessage: vi.fn(),
}));

vi.mock("../api", () => ({
  updateConversationMessages: vi.fn(),
  updateConversationTitle: vi.fn(),
  generateTitle: vi.fn(),
}));
```

## Test Utilities

### Custom `renderHook`
Wraps hooks with test providers:
```typescript
import { renderHook, act, waitFor } from "../test/test-utils";

const { result } = renderHook(() => useQuery(queryFn, []));
```

### Deferred Promise Helper
For testing async flows:
```typescript
import { createDeferred } from "../test/test-utils";

const deferred = createDeferred<Data>();
mockFn.mockReturnValue(deferred.promise);

// Later...
deferred.resolve({ data: "test" });
```

## Coverage Goals

| Layer | Target | Status |
|-------|--------|--------|
| Custom Hooks | 80%+ | Implemented |
| Utility Functions | 90%+ | Implemented |
| Type Guards | 100% | Implemented |
| UI Components | 0% | Skipped (low value) |

## Not Tested

Per the testing plan, the following are intentionally not tested:

- **Presentational components** (Button, Badge, Card, Dialog) - high churn, low logic
- **View components** - too coupled to backend, better covered by E2E
- **Icon components** - purely visual
- **Context providers** - tested via hooks that consume them
- **`usePracticeSession`** - deferred due to high complexity and external dependencies

## Adding New Tests

1. Create test file next to source: `src/hooks/useNewHook.test.ts`
2. Import test utilities:
   ```typescript
   import { describe, it, expect, vi, beforeEach } from "vitest";
   import { renderHook, act, waitFor } from "../test/test-utils";
   ```
3. Mock external dependencies at top of file
4. Group tests with `describe` blocks
5. Run `npm run test:watch` during development
