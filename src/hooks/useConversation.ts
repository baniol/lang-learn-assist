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
  sendMessage: (content: string) => Promise<void>;
  loadMessages: () => void;
  clearError: () => void;
  deleteMessage: (messageId: string) => void;
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
    async (content: string) => {
      if (!conversation || !content.trim()) return;

      setError(null);
      setIsLoading(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content,
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
          content: response.content.trim(),
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        await saveMessages(finalMessages);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        setMessages(messages);
      } finally {
        setIsLoading(false);
      }
    },
    [conversation, messages, saveMessages]
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      setMessages((prevMessages) => {
        const msgIndex = prevMessages.findIndex((msg) => msg.id === messageId);
        if (msgIndex === -1) return prevMessages;

        const msg = prevMessages[msgIndex];
        let newMessages: ChatMessage[];

        if (msg.role === "assistant") {
          // If deleting assistant message, also delete the preceding user message
          if (msgIndex > 0 && prevMessages[msgIndex - 1].role === "user") {
            newMessages = prevMessages.filter((_, i) => i !== msgIndex && i !== msgIndex - 1);
          } else {
            newMessages = prevMessages.filter((_, i) => i !== msgIndex);
          }
        } else {
          // If deleting user message, also delete the following assistant message
          if (msgIndex < prevMessages.length - 1 && prevMessages[msgIndex + 1].role === "assistant") {
            newMessages = prevMessages.filter((_, i) => i !== msgIndex && i !== msgIndex + 1);
          } else {
            newMessages = prevMessages.filter((_, i) => i !== msgIndex);
          }
        }

        saveMessages(newMessages);
        return newMessages;
      });
    },
    [saveMessages]
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
    deleteMessage,
  };
}
