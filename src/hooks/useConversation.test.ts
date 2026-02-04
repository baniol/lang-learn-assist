import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "../test/test-utils";
import { useConversation, parseMessages } from "./useConversation";
import type { Conversation, ChatMessage } from "../types";

// Mock the API and LLM modules
vi.mock("../lib/llm", () => ({
  sendConversationMessage: vi.fn(),
}));

vi.mock("../api", () => ({
  updateConversationMessages: vi.fn(),
  updateConversationTitle: vi.fn(),
  generateTitle: vi.fn(),
}));

import { sendConversationMessage } from "../lib/llm";
import {
  updateConversationMessages,
  updateConversationTitle,
  generateTitle,
} from "../api";

const mockSendConversationMessage = vi.mocked(sendConversationMessage);
const mockUpdateConversationMessages = vi.mocked(updateConversationMessages);
const mockUpdateConversationTitle = vi.mocked(updateConversationTitle);
const mockGenerateTitle = vi.mocked(generateTitle);

describe("parseMessages", () => {
  it("should return empty array for null input", () => {
    expect(parseMessages(null)).toEqual([]);
  });

  it("should return empty array for undefined input", () => {
    expect(parseMessages(undefined)).toEqual([]);
  });

  it("should return empty array for empty string", () => {
    expect(parseMessages("")).toEqual([]);
  });

  it("should return empty array for invalid JSON", () => {
    expect(parseMessages("not json")).toEqual([]);
    expect(parseMessages("{invalid}")).toEqual([]);
  });

  it("should return empty array for non-array JSON", () => {
    expect(parseMessages('{"key": "value"}')).toEqual([]);
    expect(parseMessages('"string"')).toEqual([]);
    expect(parseMessages("123")).toEqual([]);
  });

  it("should parse valid messages", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "Hello" },
      { id: "2", role: "assistant", content: "Hi there" },
    ];
    const json = JSON.stringify(messages);

    expect(parseMessages(json)).toEqual(messages);
  });

  it("should filter out invalid messages", () => {
    const mixed = [
      { id: "1", role: "user", content: "Valid" },
      { id: 123, role: "user", content: "Invalid id" }, // id should be string
      { id: "3", role: "invalid", content: "Invalid role" },
      { id: "4", role: "assistant", content: 123 }, // content should be string
      { id: "5", role: "assistant", content: "Valid too" },
      null,
      undefined,
      "string",
    ];
    const json = JSON.stringify(mixed);

    const result = parseMessages(json);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "1", role: "user", content: "Valid" });
    expect(result[1]).toEqual({
      id: "5",
      role: "assistant",
      content: "Valid too",
    });
  });

  it("should filter messages missing required fields", () => {
    const incomplete = [
      { id: "1", role: "user" }, // missing content
      { id: "2", content: "Hi" }, // missing role
      { role: "user", content: "Hi" }, // missing id
      { id: "4", role: "user", content: "Complete" },
    ];
    const json = JSON.stringify(incomplete);

    const result = parseMessages(json);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: "4", role: "user", content: "Complete" });
  });
});

describe("useConversation", () => {
  const mockConversation: Conversation = {
    id: 1,
    title: "Test Conversation",
    subject: "General",
    targetLanguage: "es",
    nativeLanguage: "en",
    status: "draft",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    rawMessagesJson: JSON.stringify([
      { id: "msg-1", role: "user", content: "Hello" },
      { id: "msg-2", role: "assistant", content: "Hola" },
    ]),
    finalMessagesJson: null,
    llmSummary: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendConversationMessage.mockResolvedValue({
      content: "Response from assistant",
      inputTokens: null,
      outputTokens: null,
    });
    mockUpdateConversationMessages.mockResolvedValue(undefined);
    mockUpdateConversationTitle.mockResolvedValue(undefined);
    mockGenerateTitle.mockResolvedValue("Generated Title");
  });

  describe("initial state", () => {
    it("should start with empty messages", () => {
      const { result } = renderHook(() =>
        useConversation({ conversation: null })
      );

      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("should not load messages automatically", () => {
      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      // Messages are not loaded automatically
      expect(result.current.messages).toEqual([]);
    });
  });

  describe("loadMessages", () => {
    it("should load messages from conversation", () => {
      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      act(() => {
        result.current.loadMessages();
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].content).toBe("Hello");
      expect(result.current.messages[1].content).toBe("Hola");
    });

    it("should clear messages when conversation is null", () => {
      const { result, rerender } = renderHook(
        ({ conversation }) => useConversation({ conversation }),
        { initialProps: { conversation: mockConversation as Conversation | null } }
      );

      act(() => {
        result.current.loadMessages();
      });

      expect(result.current.messages).toHaveLength(2);

      rerender({ conversation: null });

      act(() => {
        result.current.loadMessages();
      });

      expect(result.current.messages).toEqual([]);
    });
  });

  describe("sendMessage", () => {
    it("should add user message optimistically", async () => {
      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      act(() => {
        result.current.loadMessages();
      });

      // Start sending and check optimistic update
      act(() => {
        result.current.sendMessage("New message");
      });

      // User message should be added immediately
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(3);
      });

      expect(result.current.messages[2].content).toBe("New message");
      expect(result.current.messages[2].role).toBe("user");

      // Wait for full completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should add assistant response after API call", async () => {
      mockSendConversationMessage.mockResolvedValue({
        content: "Assistant response",
        inputTokens: null,
        outputTokens: null,
      });

      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      act(() => {
        result.current.loadMessages();
      });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.messages).toHaveLength(4);
      expect(result.current.messages[3].content).toBe("Assistant response");
      expect(result.current.messages[3].role).toBe("assistant");
    });

    it("should set loading state during send", async () => {
      let resolvePromise: (value: { content: string; inputTokens: number | null; outputTokens: number | null }) => void;
      mockSendConversationMessage.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      act(() => {
        result.current.loadMessages();
      });

      // Start send without awaiting
      act(() => {
        result.current.sendMessage("Hello");
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Resolve and wait for completion
      await act(async () => {
        resolvePromise!({ content: "Response", inputTokens: null, outputTokens: null });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should revert on error", async () => {
      mockSendConversationMessage.mockRejectedValue(new Error("API Error"));

      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      act(() => {
        result.current.loadMessages();
      });

      const initialLength = result.current.messages.length;

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      // Should revert to original messages
      expect(result.current.messages.length).toBe(initialLength);
      expect(result.current.error).toBe("API Error");
    });

    it("should not send empty message", async () => {
      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      await act(async () => {
        await result.current.sendMessage("");
        await result.current.sendMessage("   ");
      });

      expect(mockSendConversationMessage).not.toHaveBeenCalled();
    });

    it("should not send when conversation is null", async () => {
      const { result } = renderHook(() =>
        useConversation({ conversation: null })
      );

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(mockSendConversationMessage).not.toHaveBeenCalled();
    });

    it("should generate title after first exchange", async () => {
      const emptyConversation = {
        ...mockConversation,
        rawMessagesJson: "[]",
      };

      const { result } = renderHook(() =>
        useConversation({ conversation: emptyConversation })
      );

      act(() => {
        result.current.loadMessages();
      });

      await act(async () => {
        await result.current.sendMessage("First message");
      });

      expect(mockGenerateTitle).toHaveBeenCalled();
      expect(mockUpdateConversationTitle).toHaveBeenCalledWith(
        emptyConversation.id,
        "Generated Title"
      );
    });

    it("should not generate title if not first exchange", async () => {
      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      act(() => {
        result.current.loadMessages();
      });

      await act(async () => {
        await result.current.sendMessage("Another message");
      });

      expect(mockGenerateTitle).not.toHaveBeenCalled();
    });

    it("should call onMessagesUpdate callback", async () => {
      const onMessagesUpdate = vi.fn();

      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation, onMessagesUpdate })
      );

      act(() => {
        result.current.loadMessages();
      });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(onMessagesUpdate).toHaveBeenCalled();
    });
  });

  describe("deleteMessage", () => {
    it("should delete a single message", async () => {
      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      act(() => {
        result.current.loadMessages();
      });

      const initialLength = result.current.messages.length;

      act(() => {
        result.current.deleteMessage("msg-1");
      });

      // Deleting user message should also delete following assistant message
      expect(result.current.messages.length).toBeLessThan(initialLength);
    });

    it("should delete user message and following assistant message", () => {
      const conversationWithPairs: Conversation = {
        ...mockConversation,
        rawMessagesJson: JSON.stringify([
          { id: "u1", role: "user", content: "First" },
          { id: "a1", role: "assistant", content: "Response 1" },
          { id: "u2", role: "user", content: "Second" },
          { id: "a2", role: "assistant", content: "Response 2" },
        ]),
      };

      const { result } = renderHook(() =>
        useConversation({ conversation: conversationWithPairs })
      );

      act(() => {
        result.current.loadMessages();
      });

      act(() => {
        result.current.deleteMessage("u1");
      });

      // Should delete "u1" and "a1"
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].id).toBe("u2");
      expect(result.current.messages[1].id).toBe("a2");
    });

    it("should delete assistant message and preceding user message", () => {
      const conversationWithPairs: Conversation = {
        ...mockConversation,
        rawMessagesJson: JSON.stringify([
          { id: "u1", role: "user", content: "First" },
          { id: "a1", role: "assistant", content: "Response 1" },
          { id: "u2", role: "user", content: "Second" },
          { id: "a2", role: "assistant", content: "Response 2" },
        ]),
      };

      const { result } = renderHook(() =>
        useConversation({ conversation: conversationWithPairs })
      );

      act(() => {
        result.current.loadMessages();
      });

      act(() => {
        result.current.deleteMessage("a1");
      });

      // Should delete "a1" and "u1"
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].id).toBe("u2");
      expect(result.current.messages[1].id).toBe("a2");
    });

    it("should save messages after delete", () => {
      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      act(() => {
        result.current.loadMessages();
      });

      act(() => {
        result.current.deleteMessage("msg-1");
      });

      expect(mockUpdateConversationMessages).toHaveBeenCalled();
    });

    it("should handle deleting non-existent message", () => {
      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      act(() => {
        result.current.loadMessages();
      });

      const initialMessages = [...result.current.messages];

      act(() => {
        result.current.deleteMessage("non-existent");
      });

      // Messages should remain unchanged
      expect(result.current.messages).toEqual(initialMessages);
    });
  });

  describe("clearError", () => {
    it("should clear error state", async () => {
      mockSendConversationMessage.mockRejectedValue(new Error("Test Error"));

      const { result } = renderHook(() =>
        useConversation({ conversation: mockConversation })
      );

      act(() => {
        result.current.loadMessages();
      });

      await act(async () => {
        await result.current.sendMessage("Hello");
      });

      expect(result.current.error).toBe("Test Error");

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });
  });
});
