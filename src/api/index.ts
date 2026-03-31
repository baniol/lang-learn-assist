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
export * as phrasesApi from "./phrases";
export * as settingsApi from "./settings";
export * as tagsApi from "./tags";

// Re-export from lib (these already exist as wrappers)
export * as audioApi from "../lib/audio";
export * as ttsApi from "../lib/tts";
export * as materialsApi from "../lib/materials";
export * as dataExportApi from "../lib/dataExport";
export * as exerciseApi from "../lib/exercise";

// Re-export individual functions for convenience
export {
  // Phrases
  getPhrases,
  createPhrase,
  createPhrasesBatch,
  updatePhrase,
  deletePhrase,
  toggleStarred,
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

export {
  // Exercise
  checkExerciseAnswer,
} from "../lib/exercise";

export {
  // Tags
  getTags,
  createTag,
  deleteTag,
  addTagToPhrase,
  removeTagFromPhrase,
  getPhraseTags,
} from "./tags";
