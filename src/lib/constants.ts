/**
 * Application-wide constants.
 * Centralized to avoid magic numbers and provide documentation.
 */

// ============================================================================
// SRS (Spaced Repetition System) Constants
// ============================================================================

export const SRS = {
  /** Default ease factor for new cards (SM-2 algorithm) */
  DEFAULT_EASE_FACTOR: 2.5,

  /** Minimum ease factor to prevent intervals from becoming too short */
  MIN_EASE_FACTOR: 1.3,

  /** Maximum ease factor to prevent intervals from becoming too long */
  MAX_EASE_FACTOR: 3.0,

  /** Correct streak required to consider a phrase "learned" */
  LEARNED_STREAK_THRESHOLD: 2,

  /** Initial interval in days for new cards after first correct answer */
  INITIAL_INTERVAL_DAYS: 1,
} as const;

// ============================================================================
// Learning Session Constants
// ============================================================================

export const LEARNING = {
  /** Default required streak to master a phrase within a session */
  DEFAULT_REQUIRED_STREAK: 2,

  /** Default failure repetitions required in speaking mode */
  DEFAULT_FAILURE_REPETITIONS: 2,

  /** Default number of new phrases to introduce per session */
  DEFAULT_NEW_PHRASES_PER_SESSION: 5,

  /** Default session phrase limit (0 = unlimited) */
  DEFAULT_SESSION_PHRASE_LIMIT: 20,

  /** Minimum streak value */
  MIN_REQUIRED_STREAK: 1,

  /** Maximum streak value */
  MAX_REQUIRED_STREAK: 10,

  /** Minimum failure repetitions */
  MIN_FAILURE_REPETITIONS: 1,

  /** Maximum failure repetitions */
  MAX_FAILURE_REPETITIONS: 5,
} as const;

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

  /** Maximum length for note content */
  MAX_NOTE_LENGTH: 10000,

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
