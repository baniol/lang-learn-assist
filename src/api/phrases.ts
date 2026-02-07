/**
 * Phrases API - CRUD, progress tracking, and refinement
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  Phrase,
  PhraseWithProgress,
  PhraseThread,
  RefinePhraseSuggestion,
  CreatePhraseRequest,
  UpdatePhraseRequest,
} from "../types";

// ============================================================================
// CRUD Operations
// ============================================================================

export async function getPhrases(options?: {
  targetLanguage?: string;
  materialId?: number;
  status?: "all" | "starred" | "excluded";
}): Promise<PhraseWithProgress[]> {
  return invoke<PhraseWithProgress[]>("get_phrases", {
    targetLanguage: options?.targetLanguage ?? null,
    materialId: options?.materialId ?? null,
    status: options?.status ?? "all",
  });
}

export async function createPhrase(request: CreatePhraseRequest): Promise<Phrase> {
  return invoke<Phrase>("create_phrase", { request });
}

export async function createPhrasesBatch(
  phrases: CreatePhraseRequest[]
): Promise<Phrase[]> {
  return invoke<Phrase[]>("create_phrases_batch", { phrases });
}

export async function updatePhrase(
  id: number,
  request: UpdatePhraseRequest
): Promise<Phrase> {
  return invoke<Phrase>("update_phrase", { id, request });
}

export async function deletePhrase(id: number): Promise<void> {
  return invoke("delete_phrase", { id });
}

// ============================================================================
// Status Toggles
// ============================================================================

export async function toggleStarred(id: number): Promise<boolean> {
  return invoke<boolean>("toggle_starred", { id });
}

export async function toggleExcluded(id: number): Promise<boolean> {
  return invoke<boolean>("toggle_excluded", { id });
}

// ============================================================================
// Audio
// ============================================================================

export async function updatePhraseAudio(
  id: number,
  audioPath: string
): Promise<void> {
  return invoke("update_phrase_audio", { id, audioPath });
}

// ============================================================================
// Phrase Refinement Threads
// ============================================================================

export async function getPhraseThread(
  phraseId: number
): Promise<PhraseThread | null> {
  return invoke<PhraseThread | null>("get_phrase_thread", { phraseId });
}

export async function createPhraseThread(
  phraseId: number
): Promise<PhraseThread> {
  return invoke<PhraseThread>("create_phrase_thread", { phraseId });
}

export async function updatePhraseThread(
  threadId: number,
  messages: PhraseThread["messages"],
  suggestion?: RefinePhraseSuggestion
): Promise<PhraseThread> {
  return invoke<PhraseThread>("update_phrase_thread", {
    threadId,
    messages,
    suggestedPrompt: suggestion?.prompt ?? null,
    suggestedAnswer: suggestion?.answer ?? null,
    suggestedAccepted: suggestion?.accepted ?? null,
  });
}

export async function acceptPhraseThread(threadId: number): Promise<void> {
  return invoke<void>("accept_phrase_thread", { threadId });
}

export async function deletePhraseThread(threadId: number): Promise<void> {
  return invoke<void>("delete_phrase_thread", { threadId });
}

export async function refinePhrase(options: {
  phrase: Phrase;
  userAnswer: string;
  threadMessages: PhraseThread["messages"];
}): Promise<RefinePhraseSuggestion> {
  return invoke<RefinePhraseSuggestion>("refine_phrase", {
    phrase: options.phrase,
    userAnswer: options.userAnswer,
    threadMessages: options.threadMessages,
  });
}
