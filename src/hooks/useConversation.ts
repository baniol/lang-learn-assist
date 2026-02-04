import { useState, useCallback, useRef } from "react";
import { sendConversationMessage } from "../lib/llm";
import {
  updateConversationMessages,
  updateConversationTitle,
  generateTitle,
} from "../api";
import type { ChatMessage, Conversation } from "../types";

function isValidChatMessage(obj: unknown): obj is ChatMessage {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as ChatMessage).id === "string" &&
    typeof (obj as ChatMessage).content === "string" &&
    ((obj as ChatMessage).role === "user" ||
      (obj as ChatMessage).role === "assistant")
  );
}

export function parseMessages(json: string | null | undefined): ChatMessage[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidChatMessage);
  } catch {
    return [];
  }
}

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

  // Ref to track messages during async operations to avoid stale closures
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const loadMessages = useCallback(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }
    setMessages(parseMessages(conversation.rawMessagesJson));
  }, [conversation]);

  const saveMessages = useCallback(
    async (newMessages: ChatMessage[]) => {
      if (!conversation) return;

      try {
        await updateConversationMessages(conversation.id, newMessages);
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

      // Capture current state at start of operation
      const previousMessages = messagesRef.current;
      const isFirstExchange = previousMessages.length === 0;

      setError(null);
      setIsLoading(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content,
      };

      const updatedMessages = [...previousMessages, userMessage];
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

        // Generate meaningful title after first exchange
        if (isFirstExchange) {
          try {
            const contentForTitle = `${content}\n${response.content.substring(0, 200)}`;
            const newTitle = await generateTitle(
              contentForTitle,
              "conversation",
              conversation.nativeLanguage
            );
            await updateConversationTitle(conversation.id, newTitle);
          } catch (titleErr) {
            console.error("Failed to generate title:", titleErr);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        // Revert to state before this operation started
        setMessages(previousMessages);
      } finally {
        setIsLoading(false);
      }
    },
    [conversation, saveMessages]
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
