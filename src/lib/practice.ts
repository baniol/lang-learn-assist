import { invoke } from "@tauri-apps/api/core";
import type {
  PracticeSession,
  PracticeMessage,
  PracticeResponse,
  PracticeMode,
  SuggestedPhrase,
} from "../types";

export async function getPracticeSessions(
  materialId: number
): Promise<PracticeSession[]> {
  return invoke<PracticeSession[]>("get_practice_sessions", { materialId });
}

export async function createPracticeSession(
  materialId: number,
  mode: PracticeMode
): Promise<PracticeSession> {
  return invoke<PracticeSession>("create_practice_session", {
    materialId,
    mode,
  });
}

export async function updatePracticeSession(
  id: number,
  messages: PracticeMessage[],
  suggestedPhrases: SuggestedPhrase[] | null
): Promise<PracticeSession> {
  return invoke<PracticeSession>("update_practice_session", {
    id,
    messages,
    suggestedPhrases,
  });
}

export async function deletePracticeSession(id: number): Promise<void> {
  return invoke<void>("delete_practice_session", { id });
}

export async function practiceSendMessage(
  materialId: number,
  mode: PracticeMode,
  userMessage: string,
  previousMessages: PracticeMessage[],
  targetLanguage: string,
  nativeLanguage: string
): Promise<PracticeResponse> {
  return invoke<PracticeResponse>("practice_send_message", {
    materialId,
    mode,
    userMessage,
    previousMessages,
    targetLanguage,
    nativeLanguage,
  });
}
