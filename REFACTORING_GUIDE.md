# Frontend Refactoring Guide

This document provides a comprehensive guide for refactoring the Lang Learn Assist frontend codebase. Follow the phases in order - each phase builds on the previous one.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Phase 1: Foundation (UI Primitives)](#phase-1-foundation-ui-primitives)
3. [Phase 2: Icons System](#phase-2-icons-system)
4. [Phase 3: State Management](#phase-3-state-management)
5. [Phase 4: Data Fetching](#phase-4-data-fetching)
6. [Phase 5: Type Safety](#phase-5-type-safety)
7. [Phase 6: Component Decomposition](#phase-6-component-decomposition)
8. [Phase 7: Error Handling](#phase-7-error-handling)
9. [Testing Strategy](#testing-strategy)
10. [Migration Checklist](#migration-checklist)

---

## Current State Analysis

### Codebase Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Largest component | 680 lines (LearnView) | <200 lines |
| Duplicated icons | ~50+ instances | 0 (centralized) |
| Prop drilling depth | 3-4 levels | 1-2 levels |
| Reusable UI components | 3 | 15+ |
| Type-safe navigation | No | Yes |
| Error boundaries | 0 | 3+ |

### File Structure - Current

```
src/
├── App.tsx
├── main.tsx
├── index.css
├── types/index.ts
├── views/           # 12 files, some very large
├── components/      # 8 files, mixed concerns
├── hooks/           # 4 files, well-structured
└── lib/             # 8 files, clean API wrappers
```

### File Structure - Target

```
src/
├── App.tsx
├── main.tsx
├── index.css
├── types/
│   ├── index.ts
│   └── navigation.ts
├── contexts/
│   ├── SettingsContext.tsx
│   └── ToastContext.tsx
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Dialog.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── Spinner.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Textarea.tsx
│   │   ├── Card.tsx
│   │   └── index.ts
│   ├── icons/
│   │   ├── Icons.tsx
│   │   └── index.ts
│   ├── layout/
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── NavItem.tsx
│   │   └── LanguageSwitcher.tsx
│   ├── phrases/
│   │   ├── PhraseCard.tsx
│   │   ├── PhraseStatusBadge.tsx
│   │   ├── PhraseList.tsx
│   │   ├── PhraseFilters.tsx
│   │   ├── AddPhraseDialog.tsx
│   │   └── PhraseRefinementDialog.tsx
│   ├── learning/
│   │   ├── ExerciseCard.tsx
│   │   ├── ManualExercise.tsx
│   │   ├── TypingExercise.tsx
│   │   ├── SpeakingExercise.tsx
│   │   ├── SessionHeader.tsx
│   │   ├── SessionComplete.tsx
│   │   └── FeedbackDisplay.tsx
│   ├── conversation/
│   │   ├── ConversationMessage.tsx
│   │   ├── MessageInput.tsx
│   │   ├── VoiceInput.tsx
│   │   └── TextInput.tsx
│   ├── audio/
│   │   ├── VoiceButton.tsx
│   │   ├── PlayButton.tsx
│   │   └── AudioPlayer.tsx
│   └── shared/
│       ├── ErrorBoundary.tsx
│       ├── ErrorFallback.tsx
│       ├── EmptyState.tsx
│       └── PageHeader.tsx
├── hooks/
│   ├── useQuery.ts
│   ├── useMutation.ts
│   ├── useSettings.ts
│   ├── useTTS.ts
│   ├── useVoiceRecording.ts
│   ├── useConversation.ts
│   └── useAudioPlayback.ts
├── lib/
│   ├── utils.ts          # cn(), formatDate(), etc.
│   ├── constants.ts      # Magic numbers, config
│   ├── llm.ts
│   ├── tts.ts
│   ├── audio.ts
│   ├── phrases.ts
│   ├── questions.ts
│   ├── notes.ts
│   ├── materials.ts
│   └── dataExport.ts
└── views/
    ├── DashboardView.tsx
    ├── ConversationView.tsx
    ├── ConversationReviewView.tsx
    ├── PhraseLibraryView.tsx
    ├── LearnView.tsx
    ├── StatsView.tsx
    ├── QuestionsView.tsx
    ├── SettingsView.tsx
    ├── NotesView.tsx
    ├── MaterialsView.tsx
    ├── MaterialCreateView.tsx
    └── MaterialReviewView.tsx
```

---

## Phase 1: Foundation (UI Primitives)

**Goal**: Create reusable UI components that replace repeated patterns.

**Estimated effort**: 2-3 hours

### 1.1 Create Utility Functions

**File**: `src/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names with Tailwind CSS conflict resolution
 * @example cn("px-4 py-2", isActive && "bg-blue-500", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date for display
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string {
  return new Date(date).toLocaleDateString(undefined, options);
}

/**
 * Formats a relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(date);
}

/**
 * Truncates text with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
```

**Dependencies to install**:
```bash
npm install clsx tailwind-merge
```

### 1.2 Create Button Component

**File**: `src/components/ui/Button.tsx`

```typescript
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-300",
  secondary:
    "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600",
  danger: "bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300",
  ghost:
    "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
          "transition-colors duration-150",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
```

### 1.3 Create Spinner Component

**File**: `src/components/ui/Spinner.tsx`

```typescript
import { cn } from "../../lib/utils";

export type SpinnerSize = "sm" | "md" | "lg";

const sizeStyles: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-3",
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-b-blue-500 border-transparent",
        sizeStyles[size],
        className
      )}
    />
  );
}

/**
 * Full-page loading spinner
 */
export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <Spinner size="md" />
    </div>
  );
}
```

### 1.4 Create Dialog Component

**File**: `src/components/ui/Dialog.tsx`

```typescript
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Dialog({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = "md",
}: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div
        className={cn(
          "bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full mx-4",
          sizeStyles[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2
            id="dialog-title"
            className="text-xl font-bold text-slate-800 dark:text-white"
          >
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>

        {/* Actions */}
        {actions && (
          <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 1.5 Create ConfirmDialog Component

**File**: `src/components/ui/ConfirmDialog.tsx`

```typescript
import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-slate-600 dark:text-slate-400">{message}</p>
    </Dialog>
  );
}
```

### 1.6 Create Badge Component

**File**: `src/components/ui/Badge.tsx`

```typescript
import { cn } from "../../lib/utils";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  success: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  error: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  info: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
```

### 1.7 Create Input Components

**File**: `src/components/ui/Input.tsx`

```typescript
import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        {hint && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-4 py-2 border rounded-lg",
            "bg-white dark:bg-slate-900 text-slate-800 dark:text-white",
            "placeholder-slate-400 dark:placeholder-slate-500",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-red-500 dark:border-red-500"
              : "border-slate-200 dark:border-slate-700",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
```

**File**: `src/components/ui/Select.tsx`

```typescript
import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, hint, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        {hint && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "w-full px-4 py-2 border rounded-lg",
            "bg-white dark:bg-slate-900 text-slate-800 dark:text-white",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-red-500 dark:border-red-500"
              : "border-slate-200 dark:border-slate-700",
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
```

**File**: `src/components/ui/Textarea.tsx`

```typescript
import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
          </label>
        )}
        {hint && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            "w-full px-4 py-3 border rounded-lg resize-none",
            "bg-white dark:bg-slate-900 text-slate-800 dark:text-white",
            "placeholder-slate-400 dark:placeholder-slate-500",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-red-500 dark:border-red-500"
              : "border-slate-200 dark:border-slate-700",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
```

### 1.8 Create Card Component

**File**: `src/components/ui/Card.tsx`

```typescript
import { cn } from "../../lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function Card({ children, className, padding = "md" }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700",
        paddingStyles[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b border-slate-200 dark:border-slate-700 pb-4 mb-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "text-lg font-semibold text-slate-800 dark:text-white",
        className
      )}
    >
      {children}
    </h3>
  );
}
```

### 1.9 Create UI Components Index

**File**: `src/components/ui/index.ts`

```typescript
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { Spinner, PageSpinner, type SpinnerSize } from "./Spinner";
export { Dialog } from "./Dialog";
export { ConfirmDialog } from "./ConfirmDialog";
export { Badge, type BadgeVariant } from "./Badge";
export { Input, type InputProps } from "./Input";
export { Select, type SelectProps, type SelectOption } from "./Select";
export { Textarea, type TextareaProps } from "./Textarea";
export { Card, CardHeader, CardTitle } from "./Card";
```

---

## Phase 2: Icons System

**Goal**: Centralize all SVG icons into a single, type-safe icon system.

**Estimated effort**: 1-2 hours

### 2.1 Create Icons Component

**File**: `src/components/icons/Icons.tsx`

```typescript
import { cn } from "../../lib/utils";

export interface IconProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
};

function createIcon(
  path: React.ReactNode,
  { fill = false, viewBox = "0 0 24 24" } = {}
) {
  return function Icon({ className, size = "md" }: IconProps) {
    return (
      <svg
        className={cn(sizeMap[size], className)}
        fill={fill ? "currentColor" : "none"}
        viewBox={viewBox}
        stroke={fill ? undefined : "currentColor"}
      >
        {path}
      </svg>
    );
  };
}

// Navigation Icons
export const ChatIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
  />
);

export const BookIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
  />
);

export const ArchiveIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
  />
);

export const LightbulbIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
  />
);

export const ChartIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
  />
);

export const QuestionIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
  />
);

export const NoteIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
  />
);

export const SettingsIcon = createIcon(
  <>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </>
);

// Action Icons
export const PlayIcon = createIcon(<path d="M8 5v14l11-7z" />, { fill: true });

export const PauseIcon = createIcon(
  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />,
  { fill: true }
);

export const StopIcon = createIcon(
  <>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </>,
  { fill: true }
);

export const PlusIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M12 4v16m8-8H4"
  />
);

export const CloseIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M6 18L18 6M6 6l12 12"
  />
);

export const CheckIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M5 13l4 4L19 7"
  />
);

export const ChevronLeftIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M15 19l-7-7 7-7"
  />
);

export const ChevronDownIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M19 9l-7 7-7-7"
  />
);

export const TrashIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
  />
);

export const EditIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
  />
);

export const SendIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
  />
);

// Star Icon (supports filled state)
export function StarIcon({
  className,
  size = "md",
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      className={cn(sizeMap[size], className)}
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );
}

// Microphone Icon
export const MicrophoneIcon = createIcon(
  <>
    <path
      d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
      fill="currentColor"
    />
    <path
      d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
      fill="currentColor"
    />
  </>,
  { fill: true }
);

// Exclude/Ban Icon
export const ExcludeIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
  />
);

// Include/Check Circle Icon
export const IncludeIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
  />
);

// Refresh/Sync Icon
export const RefreshIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
  />
);

// Warning/Alert Icon
export const WarningIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
  />
);

// Success/Check Circle Icon
export const SuccessIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
  />
);

// Calendar Icon
export const CalendarIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
  />
);

// Download Icon
export const DownloadIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
  />
);

// Upload Icon
export const UploadIcon = createIcon(
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
  />
);
```

### 2.2 Create Icons Index

**File**: `src/components/icons/index.ts`

```typescript
export * from "./Icons";
export type { IconProps } from "./Icons";
```

### 2.3 Usage Examples

```typescript
// Before (repeated inline SVG)
<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
  <path d="M8 5v14l11-7z" />
</svg>

// After (centralized icon)
import { PlayIcon } from "@/components/icons";

<PlayIcon size="md" />
<PlayIcon size="lg" className="text-blue-500" />
```

---

## Phase 3: State Management

**Goal**: Eliminate prop drilling by implementing React Context for shared state.

**Estimated effort**: 2-3 hours

### 3.1 Create Settings Context

**File**: `src/contexts/SettingsContext.tsx`

```typescript
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types";

interface SettingsContextValue {
  settings: AppSettings | null;
  isLoading: boolean;
  error: string | null;
  updateSettings: (settings: AppSettings) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await invoke<AppSettings>("get_settings");
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Failed to load settings:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      await invoke("save_settings", { settings: newSettings });
      setSettings(newSettings);
    } catch (err) {
      console.error("Failed to save settings:", err);
      throw err;
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  return (
    <SettingsContext.Provider
      value={{ settings, isLoading, error, updateSettings, refreshSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

/**
 * Returns just the settings object, throws if not loaded.
 * Use this when you're certain settings are already loaded.
 */
export function useSettingsValue(): AppSettings {
  const { settings } = useSettings();
  if (!settings) {
    throw new Error("Settings not loaded yet");
  }
  return settings;
}
```

### 3.2 Create Toast/Notification Context

**File**: `src/contexts/ToastContext.tsx`

```typescript
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 5000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, type, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Toast Container Component
function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  const typeStyles = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-amber-500",
    info: "bg-blue-500",
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${typeStyles[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] animate-slide-in`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/80 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 3.3 Update App.tsx to Use Contexts

**File**: `src/App.tsx` (updated)

```typescript
import { useState, useCallback } from "react";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { ToastProvider } from "./contexts/ToastContext";
import { Layout } from "./components/Layout";
import { QuickNotePopup } from "./components/QuickNotePopup";
import { PageSpinner } from "./components/ui";
// ... import views

import type { ViewType } from "./types";

interface ViewState {
  type: ViewType;
  data?: Record<string, unknown>;
}

function AppContent() {
  const { settings, isLoading } = useSettings();
  const [viewState, setViewState] = useState<ViewState>({ type: "dashboard" });
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);

  const handleNavigate = useCallback((view: ViewType, data?: unknown) => {
    setViewState({ type: view, data: data as Record<string, unknown> | undefined });
  }, []);

  if (isLoading) {
    return <PageSpinner />;
  }

  const renderView = () => {
    switch (viewState.type) {
      case "dashboard":
        return <DashboardView onNavigate={handleNavigate} />;
      case "conversation":
        return (
          <ConversationView
            conversationId={viewState.data?.conversationId as number}
            onNavigate={handleNavigate}
          />
        );
      // ... other views (no longer need to pass settings prop!)
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <>
      <Layout
        currentView={viewState.type}
        onNavigate={handleNavigate}
        onQuickNoteOpen={() => setIsQuickNoteOpen(true)}
      >
        {renderView()}
      </Layout>
      <QuickNotePopup
        isOpen={isQuickNoteOpen}
        onClose={() => setIsQuickNoteOpen(false)}
      />
    </>
  );
}

function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </SettingsProvider>
  );
}

export default App;
```

---

## Phase 4: Data Fetching

**Goal**: Create reusable hooks for data fetching with loading/error states.

**Estimated effort**: 1-2 hours

### 4.1 Create useQuery Hook

**File**: `src/hooks/useQuery.ts`

```typescript
import { useState, useEffect, useCallback, useRef, type DependencyList } from "react";

interface UseQueryOptions<T> {
  /** If false, query won't run automatically */
  enabled?: boolean;
  /** Initial data before first fetch */
  initialData?: T;
  /** Called on successful fetch */
  onSuccess?: (data: T) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

interface UseQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useQuery<T>(
  queryFn: () => Promise<T>,
  deps: DependencyList = [],
  options: UseQueryOptions<T> = {}
): UseQueryResult<T> {
  const { enabled = true, initialData = null, onSuccess, onError } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  // Use ref to track if component is mounted
  const isMountedRef = useRef(true);

  // Store callbacks in refs to avoid dependency issues
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const execute = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await queryFn();
      if (isMountedRef.current) {
        setData(result);
        onSuccessRef.current?.(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onErrorRef.current?.(error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, queryFn]);

  useEffect(() => {
    isMountedRef.current = true;
    execute();
    return () => {
      isMountedRef.current = false;
    };
  }, [...deps, enabled]);

  const refetch = useCallback(async () => {
    await execute();
  }, [execute]);

  return { data, isLoading, error, refetch };
}
```

### 4.2 Create useMutation Hook

**File**: `src/hooks/useMutation.ts`

```typescript
import { useState, useCallback, useRef } from "react";

interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | null, error: Error | null, variables: TVariables) => void;
}

interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData>;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  data: TData | null;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

export function useMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TVariables> = {}
): UseMutationResult<TData, TVariables> {
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await mutationFn(variables);
        setData(result);
        optionsRef.current.onSuccess?.(result, variables);
        optionsRef.current.onSettled?.(result, null, variables);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        optionsRef.current.onError?.(error, variables);
        optionsRef.current.onSettled?.(null, error, variables);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn]
  );

  const mutate = useCallback(
    (variables: TVariables) => {
      mutateAsync(variables).catch(() => {
        // Error is already handled via state
      });
      return mutateAsync(variables);
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, mutateAsync, data, isLoading, error, reset };
}
```

### 4.3 Usage Examples

```typescript
// Before
const [phrases, setPhrases] = useState<PhraseWithProgress[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  loadPhrases();
}, []);

const loadPhrases = async () => {
  setIsLoading(true);
  try {
    const data = await invoke<PhraseWithProgress[]>("get_phrases", { ... });
    setPhrases(data);
  } catch (err) {
    setError(String(err));
  } finally {
    setIsLoading(false);
  }
};

// After
const { data: phrases, isLoading, error, refetch } = useQuery(
  () => invoke<PhraseWithProgress[]>("get_phrases", { ... }),
  [filterStatus, showStarredOnly] // dependencies
);

// For mutations
const deleteMutation = useMutation(
  (id: number) => invoke("delete_phrase", { id }),
  {
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err.message),
  }
);

// Usage
deleteMutation.mutate(phraseId);
```

---

## Phase 5: Type Safety

**Goal**: Improve type safety, especially for navigation.

**Estimated effort**: 1-2 hours

### 5.1 Create Type-Safe Navigation

**File**: `src/types/navigation.ts`

```typescript
// Type-safe view state definitions
export type ViewState =
  | { type: "dashboard" }
  | { type: "conversation"; conversationId: number }
  | { type: "conversation-review"; conversationId: number }
  | { type: "phrase-library" }
  | { type: "learn" }
  | { type: "stats" }
  | { type: "questions" }
  | { type: "settings" }
  | { type: "notes" }
  | { type: "materials" }
  | { type: "material-create" }
  | { type: "material-review"; materialId: number };

// Extract view type from ViewState
export type ViewType = ViewState["type"];

// Helper type to get data for a specific view
export type ViewData<T extends ViewType> = Extract<ViewState, { type: T }>;

// Navigation function type
export type NavigateFn = <T extends ViewType>(
  view: T,
  ...args: ViewData<T> extends { type: T } & infer R
    ? keyof Omit<R, "type"> extends never
      ? []
      : [Omit<R, "type">]
    : never
) => void;
```

### 5.2 Create Navigation Hook

**File**: `src/hooks/useNavigation.ts`

```typescript
import { useCallback, useState } from "react";
import type { ViewState, ViewType, NavigateFn } from "../types/navigation";

export function useNavigation(initialView: ViewState = { type: "dashboard" }) {
  const [viewState, setViewState] = useState<ViewState>(initialView);

  const navigate: NavigateFn = useCallback((view, data?) => {
    setViewState({ type: view, ...data } as ViewState);
  }, []);

  return {
    viewState,
    navigate,
    currentView: viewState.type,
  };
}

// Type guard helpers
export function isConversationView(
  state: ViewState
): state is { type: "conversation"; conversationId: number } {
  return state.type === "conversation";
}

export function isMaterialReviewView(
  state: ViewState
): state is { type: "material-review"; materialId: number } {
  return state.type === "material-review";
}
```

### 5.3 Usage Examples

```typescript
// Before (unsafe)
onNavigate("conversation", { conversationId: 123 });
const id = viewState.data?.conversationId as number; // type assertion

// After (type-safe)
navigate("conversation", { conversationId: 123 }); // TypeScript ensures correct data
if (isConversationView(viewState)) {
  const id = viewState.conversationId; // correctly typed as number
}
```

### 5.4 Create Constants File

**File**: `src/lib/constants.ts`

```typescript
/**
 * SRS Algorithm Constants
 */
export const SRS = {
  /** Default ease factor for new cards */
  DEFAULT_EASE_FACTOR: 2.5,
  /** Minimum ease factor */
  MIN_EASE_FACTOR: 1.3,
  /** Correct streak required to consider phrase "learned" */
  LEARNED_STREAK_THRESHOLD: 2,
} as const;

/**
 * Learning Session Constants
 */
export const LEARNING = {
  /** Default required streak to master a phrase in a session */
  DEFAULT_REQUIRED_STREAK: 2,
  /** Default failure repetitions in speaking mode */
  DEFAULT_FAILURE_REPETITIONS: 2,
  /** Default new phrases per session */
  DEFAULT_NEW_PHRASES_PER_SESSION: 5,
  /** Default session phrase limit (0 = unlimited) */
  DEFAULT_SESSION_PHRASE_LIMIT: 20,
} as const;

/**
 * UI Constants
 */
export const UI = {
  /** Debounce delay for search inputs (ms) */
  SEARCH_DEBOUNCE_MS: 300,
  /** Toast notification default duration (ms) */
  TOAST_DURATION_MS: 5000,
  /** Auto-save debounce delay (ms) */
  AUTO_SAVE_DEBOUNCE_MS: 500,
} as const;

/**
 * Language flag emojis
 */
export const LANGUAGE_FLAGS: Record<string, string> = {
  de: "🇩🇪",
  en: "🇬🇧",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
  pl: "🇵🇱",
} as const;
```

---

## Phase 6: Component Decomposition

**Goal**: Break down large views into smaller, focused components.

**Estimated effort**: 4-6 hours

### 6.1 LearnView Decomposition

**Target structure**:
```
src/components/learning/
├── SessionHeader.tsx      # Progress stats, end session button
├── ExerciseCard.tsx       # Main card wrapper with prompt
├── ManualExercise.tsx     # Show answer + self-grade buttons
├── TypingExercise.tsx     # Text input + check answer
├── SpeakingExercise.tsx   # Voice button + transcription
├── FeedbackDisplay.tsx    # Correct/incorrect feedback with actions
├── SessionComplete.tsx    # End of session summary
├── SessionStats.tsx       # Pre-session stats display
└── ModeSelector.tsx       # Exercise mode selection
```

**File**: `src/components/learning/SessionHeader.tsx`

```typescript
import { Button } from "../ui";

interface SessionHeaderProps {
  seenCount: number;
  totalLimit: number;
  correctCount: number;
  newCount: number;
  newLimit: number;
  learnedCount: number;
  onEndSession: () => void;
}

export function SessionHeader({
  seenCount,
  totalLimit,
  correctCount,
  newCount,
  newLimit,
  learnedCount,
  onEndSession,
}: SessionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Practiced: {seenCount}
          {totalLimit > 0 && `/${totalLimit}`}
          {" | "}Correct: {correctCount}
          {" | "}New: {newCount}
          {newLimit > 0 && `/${newLimit}`}
          {" | "}Learned: {learnedCount}
        </p>
      </div>
      <Button variant="ghost" onClick={onEndSession}>
        End Session
      </Button>
    </div>
  );
}
```

**File**: `src/components/learning/FeedbackDisplay.tsx`

```typescript
import { Button } from "../ui";
import { PlayIcon } from "../icons";

interface FeedbackDisplayProps {
  type: "correct" | "incorrect";
  correctAnswer: string;
  userAnswer?: string;
  onPlayAudio: () => void;
  onProceed?: () => void;
  onTryAgain?: () => void;
  onOverride?: () => void;
  onAskAI?: () => void;
  isPlaying?: boolean;
  isLoading?: boolean;
  showProceed?: boolean;
  retryInfo?: {
    remaining: number;
    isRetryMode: boolean;
  };
}

export function FeedbackDisplay({
  type,
  correctAnswer,
  userAnswer,
  onPlayAudio,
  onProceed,
  onTryAgain,
  onOverride,
  onAskAI,
  isPlaying,
  isLoading,
  showProceed,
  retryInfo,
}: FeedbackDisplayProps) {
  const isCorrect = type === "correct";

  return (
    <div
      className={`text-center py-4 rounded-lg mb-6 ${
        isCorrect
          ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
          : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
      }`}
    >
      <p className="text-lg font-medium">
        {isCorrect ? "Correct!" : "Not quite..."}
      </p>

      {isCorrect && showProceed && (
        <>
          <p className="text-lg mt-2">
            <strong>{correctAnswer}</strong>
          </p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={onPlayAudio}
              disabled={isPlaying || isLoading}
              className="p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-full transition-colors"
              title="Listen to pronunciation (P)"
            >
              <PlayIcon size="md" />
            </button>
            <Button onClick={onProceed}>Continue</Button>
          </div>
          <p className="text-sm mt-2 text-green-500">
            Press <kbd className="px-1 py-0.5 bg-green-100 dark:bg-green-800 rounded">Space</kbd> to continue
          </p>
        </>
      )}

      {!isCorrect && (
        <>
          {userAnswer && (
            <p className="text-sm mt-1">
              You said: <strong>"{userAnswer}"</strong>
            </p>
          )}
          <p className="text-sm mt-1">
            Correct answer: <strong>{correctAnswer}</strong>
          </p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={onPlayAudio}
              disabled={isPlaying || isLoading}
              className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors"
            >
              <PlayIcon size="md" />
            </button>
            {onOverride && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOverride}
                className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              >
                I said it correctly
              </Button>
            )}
            {onAskAI && (
              <Button variant="secondary" size="sm" onClick={onAskAI}>
                Ask AI
              </Button>
            )}
          </div>
        </>
      )}

      {retryInfo?.isRetryMode && (
        <div className="mt-4 py-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
          <p className="text-amber-700 dark:text-amber-400 font-medium">
            Repeat correctly {retryInfo.remaining} more time
            {retryInfo.remaining !== 1 ? "s" : ""} to continue
          </p>
        </div>
      )}
    </div>
  );
}
```

### 6.2 PhraseLibraryView Decomposition

**Target structure**:
```
src/components/phrases/
├── PhraseList.tsx         # List wrapper with empty state
├── PhraseListItem.tsx     # Single phrase row in list
├── PhraseFilters.tsx      # Status, starred, excluded, language filters
├── PhraseSearch.tsx       # Search input with debounce
├── AddPhraseDialog.tsx    # Add new phrase form
├── PhraseStatusBadge.tsx  # Status badge with tooltip
└── PhraseActions.tsx      # Play, edit, exclude, delete buttons
```

### 6.3 SettingsView Decomposition

**Target structure**:
```
src/components/settings/
├── LlmSettings.tsx        # LLM provider, API key, model
├── WhisperSettings.tsx    # Whisper model management
├── TtsSettings.tsx        # TTS provider, voice configuration
├── LanguageSettings.tsx   # Target/native language
├── LearningSettings.tsx   # Streak, retry, session limits
├── DataManagement.tsx     # Export/import
└── SettingsSection.tsx    # Reusable section wrapper
```

---

## Phase 7: Error Handling

**Goal**: Add proper error boundaries and improve error UX.

**Estimated effort**: 1-2 hours

### 7.1 Create Error Boundary

**File**: `src/components/shared/ErrorBoundary.tsx`

```typescript
import { Component, type ReactNode, type ErrorInfo } from "react";
import { ErrorFallback } from "./ErrorFallback";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}
```

**File**: `src/components/shared/ErrorFallback.tsx`

```typescript
import { Button } from "../ui";

interface ErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
}

export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          {error?.message || "An unexpected error occurred"}
        </p>
        {onReset && (
          <Button onClick={onReset}>Try Again</Button>
        )}
      </div>
    </div>
  );
}
```

### 7.2 Create Empty State Component

**File**: `src/components/shared/EmptyState.tsx`

```typescript
import { type ReactNode } from "react";
import { Button } from "../ui";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {icon && (
        <div className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-slate-500 dark:text-slate-400 mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}
```

---

## Testing Strategy

### Unit Tests

Test individual components and hooks:

```typescript
// Example: Testing Button component
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<Button isLoading>Click me</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });
});
```

### Integration Tests

Test component interactions:

```typescript
// Example: Testing PhraseList with filters
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PhraseLibraryView } from "./PhraseLibraryView";

describe("PhraseLibraryView", () => {
  it("filters phrases by status", async () => {
    render(<PhraseLibraryView />);
    
    fireEvent.click(screen.getByText("Learned"));
    
    await waitFor(() => {
      expect(screen.queryByText("New phrase")).not.toBeInTheDocument();
      expect(screen.getByText("Learned phrase")).toBeInTheDocument();
    });
  });
});
```

---

## Migration Checklist

Use this checklist to track progress:

### Phase 1: Foundation ✅ COMPLETE
- [x] Install dependencies (`clsx`, `tailwind-merge`)
- [x] Create `src/lib/utils.ts`
- [x] Create `src/components/ui/Button.tsx`
- [x] Create `src/components/ui/Spinner.tsx`
- [x] Create `src/components/ui/Dialog.tsx`
- [x] Create `src/components/ui/ConfirmDialog.tsx`
- [x] Create `src/components/ui/Badge.tsx`
- [x] Create `src/components/ui/Input.tsx`
- [x] Create `src/components/ui/Select.tsx`
- [x] Create `src/components/ui/Textarea.tsx`
- [x] Create `src/components/ui/Card.tsx`
- [x] Create `src/components/ui/index.ts`
- [x] Replace button usages in existing code
- [x] Replace dialog usages in existing code
- [x] Run type check and fix issues
- [x] **Bonus**: Created `AIChatPanel.tsx` for unified AI chat UI

### Phase 2: Icons ✅ COMPLETE
- [x] Create `src/components/icons/Icons.tsx`
- [x] Create `src/components/icons/index.ts`
- [x] Replace icons in `Layout.tsx`
- [x] Replace icons in all views (0 inline SVGs in views)
- [x] Replace icons in `VoiceButton.tsx`
- [x] Replace icons in `PhraseCard.tsx`
- [x] Replace icons in `ConversationMessage.tsx`
- [x] Replace icons in `QuickNotePopup.tsx`
- [x] Added `MicrophoneOutlineIcon` for stroke-based variant

### Phase 3: State Management ✅ COMPLETE
- [x] Create `src/contexts/SettingsContext.tsx`
- [x] Create `src/contexts/ToastContext.tsx`
- [x] Update `App.tsx` to use context providers
- [x] Update `SettingsView.tsx` to use `useSettings()`
- [x] Remove `settings` prop from `DashboardView.tsx`
- [x] Remove `settings` prop from `LearnView.tsx`
- [x] Remove `settings` prop from `PhraseLibraryView.tsx`
- [x] Remove `settings` prop from `QuestionsView.tsx`
- [x] Remove `settings` prop from `StatsView.tsx`
- [x] Remove `settings` prop from `MaterialsView.tsx`
- [x] Remove `settings` prop from `MaterialCreateView.tsx`
- [x] Add `useToast()` for error notifications in views (done in Phase 4)

### Phase 4: Data Fetching ✅ COMPLETE
- [x] Create `src/hooks/useQuery.ts`
- [x] Create `src/hooks/useMutation.ts`
- [x] Refactor `DashboardView` to use `useQuery` and `useMutation`
- [x] Refactor `StatsView` to use `useQuery`
- [x] Refactor `QuestionsView` to use `useQuery` and `useMutation`
- [x] Refactor `MaterialsView` to use `useQuery` and `useMutation`
- [x] Refactor `NotesView` to use `useQuery` and `useMutation`
- [x] Add `useToast()` for error/success notifications
- [ ] Refactor `PhraseLibraryView` (complex, 700+ lines - defer to Phase 6)

### Phase 5: Type Safety ✅ COMPLETE
- [x] Create `src/types/navigation.ts`
- [x] Create `src/lib/constants.ts`
- [x] Create `src/hooks/useNavigation.ts`
- [x] Update `App.tsx` to use type-safe navigation with type guards
- [x] Replace magic numbers with constants (ToastContext, PhraseLibraryView)
- [x] Add legacy navigate wrapper for gradual migration

### Phase 6: Component Decomposition ❌ NOT STARTED
- [ ] Create `src/components/learning/` directory
- [ ] Extract `SessionHeader.tsx` from `LearnView.tsx`
- [ ] Extract `FeedbackDisplay.tsx` from `LearnView.tsx`
- [ ] Extract remaining learning components
- [ ] Refactor `LearnView.tsx` to use new components
- [ ] Create `src/components/phrases/` directory
- [ ] Extract phrase components from `PhraseLibraryView.tsx`
- [ ] Create `src/components/settings/` directory
- [ ] Extract settings sections from `SettingsView.tsx`
- [ ] Run type check and fix issues

### Phase 7: Error Handling ✅ COMPLETE
- [x] Create `src/components/shared/ErrorBoundary.tsx`
- [x] Create `src/components/shared/ErrorFallback.tsx`
- [x] Create `src/components/shared/EmptyState.tsx`
- [x] Wrap main views in error boundaries (App.tsx)
- [ ] Replace inline empty states with `EmptyState` component (optional)

### Final Validation
- [ ] Run `make type-check`
- [ ] Run `make dev` and test all features
- [ ] Review all changed files
- [ ] Update any broken imports
- [ ] Test on both light and dark mode

---

## Notes for Implementation

1. **Work incrementally**: Complete one phase before starting the next
2. **Test after each change**: Run `make type-check` frequently
3. **Preserve functionality**: Each refactor should maintain existing behavior
4. **Update imports**: When moving files, update all import statements
5. **Document decisions**: Add comments for non-obvious choices
6. **Keep old code working**: Don't break existing features while refactoring

---

## Questions to Consider Before Each Phase

1. Are there any pending features that might conflict with this refactor?
2. Are there any edge cases in the current implementation we need to preserve?
3. Should we add any additional abstractions based on patterns we see?
4. Are there any performance implications to consider?
