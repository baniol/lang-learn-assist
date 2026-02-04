# CLAUDE.md

Tauri desktop app: React/TypeScript frontend + Rust backend. Language learning with AI conversations, phrase extraction, and SRS practice.

## Commands
```bash
make dev          # Run development
make build        # Production build
make type-check   # TypeScript check
make test-rust    # Rust tests
npm test          # Run frontend tests (Vitest)
npm run test:ui   # Run tests with UI
npm run coverage  # Run tests with coverage report
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
- `src/__tests__/` - Frontend test examples and patterns
