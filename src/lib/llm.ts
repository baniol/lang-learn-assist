import { invoke } from "@tauri-apps/api/core";
import type {
  ChatMessage,
  ConversationCleanupResult,
  LlmResponse,
  SuggestedPhrase,
} from "../types";

export async function sendConversationMessage(
  messages: ChatMessage[],
  subject: string,
  targetLanguage: string,
  nativeLanguage: string
): Promise<LlmResponse> {
  return invoke<LlmResponse>("send_conversation_message", {
    messages,
    subject,
    targetLanguage,
    nativeLanguage,
  });
}

export async function suggestConversationCleanup(
  messages: ChatMessage[],
  targetLanguage: string,
  nativeLanguage: string
): Promise<ConversationCleanupResult> {
  return invoke<ConversationCleanupResult>("suggest_conversation_cleanup", {
    messages,
    targetLanguage,
    nativeLanguage,
  });
}

export async function extractPhrasesFromConversation(
  messages: ChatMessage[],
  targetLanguage: string,
  nativeLanguage: string
): Promise<SuggestedPhrase[]> {
  return invoke<SuggestedPhrase[]>("extract_phrases_from_conversation", {
    messages,
    targetLanguage,
    nativeLanguage,
  });
}

export async function testLlmConnection(): Promise<string> {
  return invoke<string>("test_llm_connection");
}
