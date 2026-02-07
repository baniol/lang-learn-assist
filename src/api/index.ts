/**
 * API Layer - All backend communication goes through these modules
 *
 * This provides a clean abstraction over Tauri's invoke calls, making it easy to:
 * - Mock for testing
 * - Add caching or offline support
 * - Switch to a different backend (e.g., web API)
 * - Maintain type safety
 */

// Core domain APIs
export * as learningApi from "./learning";
export * as phrasesApi from "./phrases";
export * as settingsApi from "./settings";

// Re-export from lib (these already exist as wrappers)
export * as audioApi from "../lib/audio";
export * as ttsApi from "../lib/tts";
export * as notesApi from "../lib/notes";
export * as questionsApi from "../lib/questions";
export * as materialsApi from "../lib/materials";
export * as dataExportApi from "../lib/dataExport";

// Re-export individual functions for convenience
export {
  // Learning
  startPracticeSession,
  startDeckSession,
  getActiveSession,
  updatePracticeSession,
  finishPracticeSession,
  getPracticeSessions,
  getNextPhrase,
  getNextDeckPhrase,
  getStudyPhrase, // Unified API
  validateAnswer,
  recordAnswer,
  recordDeckAnswer,
  recordStudyAnswer, // Unified API
  getLearningStats,
  getSrsStats,
  resetPracticeSessions,
  resetPhraseProgress,
} from "./learning";

export {
  // Phrases
  getPhrases,
  createPhrase,
  createPhrasesBatch,
  updatePhrase,
  deletePhrase,
  toggleStarred,
  toggleExcluded,
  updatePhraseAudio,
  getPhraseThread,
  createPhraseThread,
  updatePhraseThread,
  acceptPhraseThread,
  deletePhraseThread,
  refinePhrase,
} from "./phrases";

export {
  // Settings
  getSettings,
  saveSettings,
  testLlmConnection,
} from "./settings";
