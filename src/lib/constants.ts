/**
 * Application-wide constants.
 * Centralized to avoid magic numbers and provide documentation.
 */

// ============================================================================
// UI Constants
// ============================================================================

export const UI = {
  /** Debounce delay for search inputs (milliseconds) */
  SEARCH_DEBOUNCE_MS: 300,

  /** Toast notification default duration (milliseconds) */
  TOAST_DURATION_MS: 5000,

  /** Auto-save debounce delay (milliseconds) */
  AUTO_SAVE_DEBOUNCE_MS: 500,

  /** Animation duration for transitions (milliseconds) */
  ANIMATION_DURATION_MS: 200,

  /** Maximum items to show in a dropdown before scrolling */
  DROPDOWN_MAX_ITEMS: 10,

  /** Sidebar width in pixels */
  SIDEBAR_WIDTH_PX: 256,
} as const;

// ============================================================================
// Language Constants
// ============================================================================

/**
 * Flag emoji for each supported language.
 */
export const LANGUAGE_FLAGS: Record<string, string> = {
  de: "🇩🇪",
  en: "🇬🇧",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
  pl: "🇵🇱",
} as const;

/**
 * Default target language code.
 */
export const DEFAULT_TARGET_LANGUAGE = "de";

/**
 * Default native language code.
 */
export const DEFAULT_NATIVE_LANGUAGE = "pl";

// ============================================================================
// API Constants
// ============================================================================

export const API = {
  /** Maximum retries for failed API calls */
  MAX_RETRIES: 3,

  /** Timeout for API calls (milliseconds) */
  TIMEOUT_MS: 30000,

  /** Delay between retries (milliseconds) */
  RETRY_DELAY_MS: 1000,
} as const;

// ============================================================================
// Audio Constants
// ============================================================================

export const AUDIO = {
  /** Sample rate for audio recording (Hz) */
  SAMPLE_RATE: 16000,

  /** Minimum recording duration (milliseconds) */
  MIN_RECORDING_MS: 200,

  /** Maximum recording duration (milliseconds) */
  MAX_RECORDING_MS: 60000,
} as const;

// ============================================================================
// Validation Constants
// ============================================================================

export const VALIDATION = {
  /** Maximum length for phrase prompt */
  MAX_PHRASE_PROMPT_LENGTH: 500,

  /** Maximum length for phrase answer */
  MAX_PHRASE_ANSWER_LENGTH: 500,

  /** Maximum length for conversation title */
  MAX_CONVERSATION_TITLE_LENGTH: 200,

  /** Minimum length for search query */
  MIN_SEARCH_LENGTH: 1,
} as const;

// ============================================================================
// Topic Categories (matching types/index.ts)
// ============================================================================

export const TOPIC_CATEGORY_IDS = [
  "restaurant",
  "shopping",
  "travel",
  "hotel",
  "doctor",
  "work",
  "smalltalk",
  "phone",
  "custom",
] as const;

export type TopicCategoryId = (typeof TOPIC_CATEGORY_IDS)[number];
