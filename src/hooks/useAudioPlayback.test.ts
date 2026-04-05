import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "../test/test-utils";
import { useAudioPlayback } from "./useAudioPlayback";

/** Chat message type for testing */
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Mock the TTS module
vi.mock("../lib/tts", () => ({
  generateTts: vi.fn(),
  getAudioBase64: vi.fn(),
  getVoiceForLanguage: vi.fn(),
  fetchAudioWithFallback: vi.fn(),
}));

import { generateTts, getVoiceForLanguage, fetchAudioWithFallback } from "../lib/tts";

const mockGenerateTts = vi.mocked(generateTts);
const mockGetVoiceForLanguage = vi.mocked(getVoiceForLanguage);
const mockFetchAudioWithFallback = vi.mocked(fetchAudioWithFallback);

describe("useAudioPlayback", () => {
  // Track Audio instances
  let audioInstances: Array<{
    onended: (() => void) | null;
    onerror: ((e: Event) => void) | null;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
  }>;

  beforeEach(() => {
    vi.clearAllMocks();
    audioInstances = [];

    // Create a mock Audio class
    class MockAudioClass {
      onended: (() => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      play = vi.fn().mockResolvedValue(undefined);
      pause = vi.fn();
      currentTime = 0;

      constructor() {
        audioInstances.push(this);
      }
    }

    globalThis.Audio = MockAudioClass as unknown as typeof Audio;

    // Default mock implementations
    mockGenerateTts.mockResolvedValue("/path/to/audio.mp3");
    mockFetchAudioWithFallback.mockResolvedValue({
      audioPath: "/path/to/audio.mp3",
      audioUrl: "data:audio/mp3;base64,test",
    });
    mockGetVoiceForLanguage.mockResolvedValue("");
  });

  describe("initial state", () => {
    it("should start with idle state", () => {
      const { result } = renderHook(() => useAudioPlayback());

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.currentlyPlayingId).toBe(null);
      expect(result.current.error).toBe(null);
    });
  });

  describe("playMessage", () => {
    it("should call TTS APIs to generate audio", async () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playback
      act(() => {
        result.current.playMessage("Hello world", "msg-1");
      });

      // Wait for loading to complete (TTS APIs called)
      await waitFor(() => {
        expect(mockGenerateTts).toHaveBeenCalledWith("Hello world", undefined, undefined);
      });

      expect(mockFetchAudioWithFallback).toHaveBeenCalledWith(
        "Hello world",
        "/path/to/audio.mp3",
        undefined,
        undefined
      );
    });

    it("should update currentlyPlayingId when playback starts", async () => {
      const { result } = renderHook(() => useAudioPlayback());

      act(() => {
        result.current.playMessage("Hello", "msg-1");
      });

      await waitFor(() => {
        expect(result.current.currentlyPlayingId).toBe("msg-1");
      });
    });

    it("should handle TTS errors", async () => {
      mockGenerateTts.mockRejectedValue(new Error("TTS failed"));

      const { result } = renderHook(() => useAudioPlayback());

      await act(async () => {
        try {
          await result.current.playMessage("Hello", "msg-1");
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBe("TTS failed");
      expect(result.current.isPlaying).toBe(false);
    });

    it("should cache audio and reuse on repeat play", async () => {
      const { result } = renderHook(() => useAudioPlayback());

      // First play
      act(() => {
        result.current.playMessage("Hello", "msg-1");
      });

      await waitFor(() => {
        expect(mockGenerateTts).toHaveBeenCalledTimes(1);
      });

      // Simulate audio ending
      act(() => {
        audioInstances[0]?.onended?.();
      });

      // Second play same text (should use cache)
      act(() => {
        result.current.playMessage("Hello", "msg-2");
      });

      // Should still be 1 call (cache hit)
      await waitFor(() => {
        expect(audioInstances.length).toBe(2);
      });

      expect(mockGenerateTts).toHaveBeenCalledTimes(1);
    });
  });

  describe("stop", () => {
    it("should reset state when stop is called", async () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playback
      act(() => {
        result.current.playMessage("Hello", "msg-1");
      });

      await waitFor(() => {
        expect(result.current.currentlyPlayingId).toBe("msg-1");
      });

      // Stop playback
      act(() => {
        result.current.stop();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.currentlyPlayingId).toBe(null);
    });
  });

  describe("playAll", () => {
    it("should only process assistant messages", async () => {
      const messages: ChatMessage[] = [
        { id: "1", role: "user", content: "Hello" },
        { id: "2", role: "assistant", content: "Hi there" },
        { id: "3", role: "user", content: "How are you?" },
        { id: "4", role: "assistant", content: "Im good" },
      ];

      const { result } = renderHook(() => useAudioPlayback());

      // Start playAll - this triggers TTS for assistant messages
      act(() => {
        result.current.playAll(messages);
      });

      // Wait for first TTS call
      await waitFor(() => {
        expect(mockGenerateTts).toHaveBeenCalled();
      });

      // First call should be for first assistant message
      expect(mockGenerateTts).toHaveBeenCalledWith("Hi there", undefined, undefined);
    });

    it("should do nothing for empty messages", async () => {
      const { result } = renderHook(() => useAudioPlayback());

      await act(async () => {
        await result.current.playAll([]);
      });

      expect(mockGenerateTts).not.toHaveBeenCalled();
    });

    it("should do nothing when only user messages", async () => {
      const messages: ChatMessage[] = [
        { id: "1", role: "user", content: "Hello" },
        { id: "2", role: "user", content: "How are you?" },
      ];

      const { result } = renderHook(() => useAudioPlayback());

      await act(async () => {
        await result.current.playAll(messages);
      });

      expect(mockGenerateTts).not.toHaveBeenCalled();
    });
  });

  describe("voice options", () => {
    it("should load per-language voice when language is provided", async () => {
      mockGetVoiceForLanguage.mockResolvedValue("lang-voice");

      renderHook(() => useAudioPlayback({ language: "de" }));

      await waitFor(() => {
        expect(mockGetVoiceForLanguage).toHaveBeenCalledWith("de");
      });
    });

    it("should use the per-language voice when playing", async () => {
      mockGetVoiceForLanguage.mockResolvedValue("lang-voice");

      const { result } = renderHook(() => useAudioPlayback({ language: "de" }));

      await waitFor(() => {
        expect(mockGetVoiceForLanguage).toHaveBeenCalledWith("de");
      });

      act(() => {
        result.current.playMessage("Hello", "msg-1");
      });

      await waitFor(() => {
        expect(mockGenerateTts).toHaveBeenCalledWith("Hello", undefined, "lang-voice");
      });
    });
  });
});
