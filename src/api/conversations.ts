/**
 * Conversations API - CRUD and conversation flow management
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  Conversation,
  ConversationCleanupResult,
  SuggestedPhrase,
  ChatMessage,
} from "../types";

// ============================================================================
// CRUD Operations
// ============================================================================

export async function getConversations(options?: {
  targetLanguage?: string;
  limit?: number;
}): Promise<Conversation[]> {
  return invoke<Conversation[]>("get_conversations", {
    targetLanguage: options?.targetLanguage ?? null,
    limit: options?.limit ?? 50,
  });
}

export async function getConversation(id: number): Promise<Conversation> {
  return invoke<Conversation>("get_conversation", { id });
}

export async function createConversation(options: {
  title: string;
  subject: string;
  targetLanguage?: string;
  nativeLanguage?: string;
}): Promise<Conversation> {
  return invoke<Conversation>("create_conversation", {
    title: options.title,
    subject: options.subject,
    targetLanguage: options.targetLanguage ?? null,
    nativeLanguage: options.nativeLanguage ?? null,
  });
}

export async function deleteConversation(id: number): Promise<void> {
  return invoke("delete_conversation", { id });
}

// ============================================================================
// Message Management
// ============================================================================

export async function updateConversationMessages(
  id: number,
  messages: ChatMessage[]
): Promise<void> {
  return invoke("update_conversation_messages", {
    id,
    messages,
  });
}

export async function updateConversationTitle(
  id: number,
  title: string
): Promise<void> {
  return invoke("update_conversation_title", { id, title });
}

// ============================================================================
// Conversation Flow
// ============================================================================

export interface LlmResponse {
  content: string;
}

export async function sendConversationMessage(options: {
  conversationId: number;
  messages: ChatMessage[];
  targetLanguage: string;
  nativeLanguage: string;
  subject: string;
}): Promise<LlmResponse> {
  return invoke<LlmResponse>("send_conversation_message", {
    conversationId: options.conversationId,
    messages: options.messages,
    targetLanguage: options.targetLanguage,
    nativeLanguage: options.nativeLanguage,
    subject: options.subject,
  });
}

export async function generateTitle(
  content: string,
  contentType: "conversation" | "question",
  nativeLanguage?: string
): Promise<string> {
  return invoke<string>("generate_title", {
    content,
    contentType,
    nativeLanguage: nativeLanguage ?? null,
  });
}

// ============================================================================
// Finalization & Phrase Extraction
// ============================================================================

export async function suggestConversationCleanup(options: {
  conversationId: number;
  messages: ChatMessage[];
  targetLanguage: string;
  nativeLanguage: string;
}): Promise<ConversationCleanupResult> {
  return invoke<ConversationCleanupResult>("suggest_conversation_cleanup", {
    conversationId: options.conversationId,
    messages: options.messages,
    targetLanguage: options.targetLanguage,
    nativeLanguage: options.nativeLanguage,
  });
}

export async function extractPhrasesFromConversation(options: {
  messages: ChatMessage[];
  targetLanguage: string;
  nativeLanguage: string;
}): Promise<SuggestedPhrase[]> {
  return invoke<SuggestedPhrase[]>("extract_phrases_from_conversation", {
    messages: options.messages,
    targetLanguage: options.targetLanguage,
    nativeLanguage: options.nativeLanguage,
  });
}

export async function finalizeConversation(
  id: number,
  finalMessages: ChatMessage[],
  summary?: string
): Promise<void> {
  return invoke("finalize_conversation", {
    id,
    finalMessages,
    summary: summary ?? null,
  });
}
