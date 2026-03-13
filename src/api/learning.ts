/**
 * Learning API - Practice sessions, answer recording, and statistics
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  AnswerResult,
  DeckAnswerResult,
  LearningStats,
  PhraseWithProgress,
  PracticeSession,
  ExerciseMode,
  StudyModeType,
  StudyAnswerResult,
} from "../types";

// ============================================================================
// Practice Sessions
// ============================================================================

export async function startPracticeSession(
  exerciseMode: ExerciseMode
): Promise<PracticeSession> {
  return invoke<PracticeSession>("start_practice_session", { exerciseMode });
}

export async function startDeckSession(
  deckId: number,
  exerciseMode: ExerciseMode
): Promise<PracticeSession> {
  return invoke<PracticeSession>("start_deck_session", { deckId, exerciseMode });
}

export async function getActiveSession(
  targetLanguage?: string
): Promise<PracticeSession | null> {
  return invoke<PracticeSession | null>("get_active_session", {
    targetLanguage: targetLanguage ?? null,
  });
}

export async function updatePracticeSession(
  sessionId: number,
  totalPhrases: number,
  correctAnswers: number
): Promise<void> {
  return invoke("update_practice_session", {
    sessionId,
    totalPhrases,
    correctAnswers,
  });
}

export async function finishPracticeSession(
  sessionId: number
): Promise<PracticeSession> {
  return invoke<PracticeSession>("finish_practice_session", { sessionId });
}

// ============================================================================
// Phrase Selection & Answer Recording
// ============================================================================

export async function getNextPhrase(options: {
  targetLanguage?: string;
  excludeIds?: number[];
  newPhraseCount?: number;
  newPhraseLimit?: number;
  sessionPosition?: number;
  newPhraseInterval?: number;
}): Promise<PhraseWithProgress | null> {
  return invoke<PhraseWithProgress | null>("get_next_phrase", {
    targetLanguage: options.targetLanguage ?? null,
    excludeIds: options.excludeIds?.length ? options.excludeIds : null,
    newPhraseCount: options.newPhraseCount ?? 0,
    newPhraseLimit: options.newPhraseLimit ?? 0,
    sessionPosition: options.sessionPosition ?? 0,
    newPhraseInterval: options.newPhraseInterval ?? 4,
  });
}

export async function validateAnswer(
  phraseId: number,
  input: string
): Promise<boolean> {
  return invoke<boolean>("validate_answer", { phraseId, input });
}

export async function recordAnswer(
  phraseId: number,
  isCorrect: boolean,
  sessionId?: number
): Promise<AnswerResult> {
  return invoke<AnswerResult>("record_answer", {
    phraseId,
    isCorrect,
    sessionId: sessionId ?? null,
  });
}

// ============================================================================
// Deck Study
// ============================================================================

export async function getNextDeckPhrase(
  deckId: number,
  excludeIds?: number[]
): Promise<PhraseWithProgress | null> {
  return invoke<PhraseWithProgress | null>("get_next_deck_phrase", {
    deckId,
    excludeIds: excludeIds?.length ? excludeIds : null,
  });
}

export async function recordDeckAnswer(
  phraseId: number,
  isCorrect: boolean,
  deckId: number,
  sessionId?: number
): Promise<DeckAnswerResult> {
  return invoke<DeckAnswerResult>("record_deck_answer", {
    phraseId,
    isCorrect,
    deckId,
    sessionId: sessionId ?? null,
  });
}

// ============================================================================
// Statistics
// ============================================================================

export async function getLearningStats(
  targetLanguage?: string
): Promise<LearningStats> {
  return invoke<LearningStats>("get_learning_stats", {
    targetLanguage: targetLanguage ?? null,
  });
}

export async function resetPracticeSessions(): Promise<number> {
  return invoke<number>("reset_practice_sessions");
}

export async function resetPhraseProgress(): Promise<number> {
  return invoke<number>("reset_phrase_progress");
}

// ============================================================================
// Unified Study API (New)
// ============================================================================

/**
 * Get the next phrase to study using the unified API.
 * Supports both deck learning and SRS review modes.
 */
export async function getStudyPhrase(
  mode: StudyModeType,
  options?: {
    excludeIds?: number[];
    newPhraseCount?: number;
    newPhraseLimit?: number;
    sessionPosition?: number;
    newPhraseInterval?: number;
    targetLanguage?: string;
  }
): Promise<PhraseWithProgress | null> {
  return invoke<PhraseWithProgress | null>("get_study_phrase", {
    mode,
    excludeIds: options?.excludeIds?.length ? options.excludeIds : null,
    newPhraseCount: options?.newPhraseCount ?? 0,
    newPhraseLimit: options?.newPhraseLimit ?? 0,
    sessionPosition: options?.sessionPosition ?? 0,
    newPhraseInterval: options?.newPhraseInterval ?? 4,
    targetLanguage: options?.targetLanguage ?? null,
  });
}

/**
 * Record an answer using the unified API.
 * Supports both deck learning and SRS review modes.
 */
export async function recordStudyAnswer(
  phraseId: number,
  isCorrect: boolean,
  mode: StudyModeType,
  sessionId?: number
): Promise<StudyAnswerResult> {
  return invoke<StudyAnswerResult>("record_study_answer", {
    phraseId,
    isCorrect,
    mode,
    sessionId: sessionId ?? null,
  });
}
