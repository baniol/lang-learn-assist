import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { sendConversationMessage } from "../lib/llm";
import type { ChatMessage, Conversation } from "../types";

interface UseConversationOptions {
  conversation: Conversation | null;
  onMessagesUpdate?: (messages: ChatMessage[]) => void;
}

interface UseConversationResult {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, isMeta?: boolean) => Promise<void>;
  loadMessages: () => void;
  clearError: () => void;
}

export function useConversation({
  conversation,
  onMessagesUpdate,
}: UseConversationOptions): UseConversationResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    try {
      const parsed = JSON.parse(conversation.rawMessagesJson || "[]");
      setMessages(parsed);
    } catch {
      setMessages([]);
    }
  }, [conversation]);

  const saveMessages = useCallback(
    async (newMessages: ChatMessage[]) => {
      if (!conversation) return;

      try {
        await invoke("update_conversation_messages", {
          id: conversation.id,
          messages: newMessages,
        });
        onMessagesUpdate?.(newMessages);
      } catch (err) {
        console.error("Failed to save messages:", err);
      }
    },
    [conversation, onMessagesUpdate]
  );

  const sendMessage = useCallback(
    async (content: string, isMeta = false) => {
      if (!conversation || !content.trim()) return;

      setError(null);
      setIsLoading(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: isMeta ? "meta" : "user",
        content: isMeta ? `[META] ${content}` : content,
        isMetaQuestion: isMeta,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      try {
        const response = await sendConversationMessage(
          updatedMessages,
          conversation.subject,
          conversation.targetLanguage,
          conversation.nativeLanguage
        );

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.content,
          isMetaQuestion: false,
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        await saveMessages(finalMessages);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        // Remove the user message on error
        setMessages(messages);
      } finally {
        setIsLoading(false);
      }
    },
    [conversation, messages, saveMessages]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    loadMessages,
    clearError,
  };
}
