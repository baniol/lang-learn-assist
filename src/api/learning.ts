/**
 * Learning API - Practice sessions, answer recording, and statistics
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  AnswerResult,
  LearningStats,
  PhraseWithProgress,
  PracticeSession,
  SrsStats,
  ExerciseMode,
} from "../types";

// ============================================================================
// Practice Sessions
// ============================================================================

export async function startPracticeSession(
  exerciseMode: ExerciseMode
): Promise<PracticeSession> {
  return invoke<PracticeSession>("start_practice_session", { exerciseMode });
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

export async function getPracticeSessions(
  limit: number = 20
): Promise<PracticeSession[]> {
  return invoke<PracticeSession[]>("get_practice_sessions", { limit });
}

// ============================================================================
// Phrase Selection & Answer Recording
// ============================================================================

export async function getNextPhrase(options: {
  targetLanguage?: string;
  excludeIds?: number[];
  newPhraseCount?: number;
  newPhraseLimit?: number;
}): Promise<PhraseWithProgress | null> {
  return invoke<PhraseWithProgress | null>("get_next_phrase", {
    targetLanguage: options.targetLanguage ?? null,
    excludeIds: options.excludeIds?.length ? options.excludeIds : null,
    newPhraseCount: options.newPhraseCount ?? 0,
    newPhraseLimit: options.newPhraseLimit ?? 0,
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
// Statistics
// ============================================================================

export async function getLearningStats(
  targetLanguage?: string
): Promise<LearningStats> {
  return invoke<LearningStats>("get_learning_stats", {
    targetLanguage: targetLanguage ?? null,
  });
}

export async function getSrsStats(targetLanguage?: string): Promise<SrsStats> {
  return invoke<SrsStats>("get_srs_stats", {
    targetLanguage: targetLanguage ?? null,
  });
}
