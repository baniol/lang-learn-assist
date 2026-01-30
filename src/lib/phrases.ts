import { invoke } from "@tauri-apps/api/core";
import type {
  Phrase,
  PhraseThread,
  PhraseThreadMessage,
  RefinePhraseSuggestion,
} from "../types";

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
  messages: PhraseThreadMessage[],
  suggestedPrompt: string | null,
  suggestedAnswer: string | null,
  suggestedAccepted: string[] | null
): Promise<PhraseThread> {
  return invoke<PhraseThread>("update_phrase_thread", {
    threadId,
    messages,
    suggestedPrompt,
    suggestedAnswer,
    suggestedAccepted,
  });
}

export async function acceptPhraseThread(threadId: number): Promise<void> {
  return invoke<void>("accept_phrase_thread", { threadId });
}

export async function deletePhraseThread(threadId: number): Promise<void> {
  return invoke<void>("delete_phrase_thread", { threadId });
}

export async function refinePhrase(
  phrase: Phrase,
  messages: PhraseThreadMessage[],
  userMessage: string
): Promise<RefinePhraseSuggestion> {
  return invoke<RefinePhraseSuggestion>("refine_phrase", {
    phrase,
    messages,
    userMessage,
  });
}
