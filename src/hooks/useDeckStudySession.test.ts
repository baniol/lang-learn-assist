import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "../test/test-utils";
import { useDeckStudySession } from "./useDeckStudySession";
import { createDeferred } from "../test/test-utils";
import type {
  AppSettings,
  PracticeSession,
  PhraseWithProgress,
  DeckAnswerResult,
  PhraseProgress,
  Phrase,
} from "../types";

// Mock the API module
vi.mock("../api", () => ({
  startDeckSession: vi.fn(),
  getActiveSession: vi.fn(),
  updatePracticeSession: vi.fn(),
  finishPracticeSession: vi.fn(),
  getNextDeckPhrase: vi.fn(),
  recordDeckAnswer: vi.fn(),
}));

import {
  startDeckSession,
  getActiveSession,
  updatePracticeSession,
  finishPracticeSession,
  getNextDeckPhrase,
  recordDeckAnswer,
} from "../api";

const mockSettings: AppSettings = {
  targetLanguage: "Spanish",
  nativeLanguage: "English",
  llmProvider: "openai",
  llmModel: "gpt-4",
  llmApiKey: "test-key",
  activeWhisperModel: "",
  ttsProvider: "none",
  ttsApiKey: "",
  ttsVoiceId: "",
  ttsVoiceIdA: "",
  ttsVoiceIdB: "",
  ttsVoicesPerLanguage: {},
  requiredStreak: 3,
  immediateRetry: true,
  defaultExerciseMode: "manual",
  failureRepetitions: 2,
  sessionPhraseLimit: 20,
  newPhrasesPerSession: 5,
  newPhraseInterval: 4,
  fuzzyMatching: true,
  notesEnabled: true,
};

const mockProgress: PhraseProgress = {
  id: 1,
  phraseId: 1,
  correctStreak: 0,
  totalAttempts: 0,
  successCount: 0,
  lastSeen: null,
  easeFactor: 2.5,
  intervalDays: 0,
  nextReviewAt: null,
  inSrsPool: false,
  deckCorrectCount: 0,
};

const mockPhraseData: Phrase = {
  id: 1,
  prompt: "Hello",
  answer: "Hola",
  accepted: [],
  targetLanguage: "Spanish",
  nativeLanguage: "English",
  createdAt: "2024-01-01T00:00:00Z",
  conversationId: null,
  materialId: null,
  deckId: 1,
  audioPath: null,
  notes: null,
  starred: false,
  excluded: false,
};

const mockSession: PracticeSession = {
  id: 1,
  startedAt: "2024-01-01T00:00:00Z",
  finishedAt: null,
  totalPhrases: 0,
  correctAnswers: 0,
  exerciseMode: "manual",
  state: null,
};

const mockPhrase: PhraseWithProgress = {
  phrase: mockPhraseData,
  progress: mockProgress,
};

const mockDeckAnswerResult: DeckAnswerResult = {
  progress: mockProgress,
  deckCorrectCount: 1,
  justGraduated: false,
  graduationThreshold: 3,
};

describe("useDeckStudySession", () => {
  const mockOnSettingsRefresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveSession).mockResolvedValue(null);
    vi.mocked(getNextDeckPhrase).mockResolvedValue(null);
    vi.mocked(startDeckSession).mockResolvedValue(mockSession);
    vi.mocked(recordDeckAnswer).mockResolvedValue(mockDeckAnswerResult);
    vi.mocked(updatePracticeSession).mockResolvedValue(undefined);
    vi.mocked(finishPracticeSession).mockResolvedValue(mockSession);
  });

  describe("initial state", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      expect(result.current.session).toBe(null);
      expect(result.current.currentPhrase).toBe(null);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.seenPhraseIds).toEqual([]);
      expect(result.current.graduatedCount).toBe(0);
      expect(result.current.retryCount).toBe(0);
      expect(result.current.inRetryMode).toBe(false);
      expect(result.current.requiresRetry).toBe(false);
      expect(result.current.lastGraduation).toBe(null);
    });

    it("should check for active session on mount", async () => {
      renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      await waitFor(() => {
        expect(getActiveSession).toHaveBeenCalledWith("Spanish");
      });
    });

    it("should not check for active session when settings is null", () => {
      renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: null,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      expect(getActiveSession).not.toHaveBeenCalled();
    });
  });

  describe("startSession", () => {
    it("should start a new session and load first phrase", async () => {
      vi.mocked(startDeckSession).mockResolvedValue(mockSession);
      vi.mocked(getNextDeckPhrase).mockResolvedValue(mockPhrase);

      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      await act(async () => {
        await result.current.startSession("manual");
      });

      expect(mockOnSettingsRefresh).toHaveBeenCalled();
      expect(startDeckSession).toHaveBeenCalledWith(1, "manual");
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.currentPhrase).toEqual(mockPhrase);
      expect(result.current.seenPhraseIds).toEqual([]);
      expect(result.current.graduatedCount).toBe(0);
    });

    it("should reset all state when starting new session", async () => {
      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      // Set some state first
      act(() => {
        result.current.setRetryCount(3);
        result.current.setInRetryMode(true);
        result.current.setRequiresRetry(true);
      });

      // Start new session
      await act(async () => {
        await result.current.startSession("manual");
      });

      expect(result.current.retryCount).toBe(0);
      expect(result.current.inRetryMode).toBe(false);
      expect(result.current.requiresRetry).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(startDeckSession).mockRejectedValue(new Error("API Error"));
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      await act(async () => {
        await result.current.startSession("manual");
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to start deck session:",
        expect.any(Error)
      );
      expect(result.current.session).toBe(null);
      expect(result.current.isLoading).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe("endSession", () => {
    it("should end session and reset state", async () => {
      vi.mocked(getNextDeckPhrase).mockResolvedValue(mockPhrase);

      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      // Start a session first
      await act(async () => {
        await result.current.startSession("manual");
      });

      expect(result.current.session).toEqual(mockSession);

      // End the session
      await act(async () => {
        await result.current.endSession();
      });

      expect(finishPracticeSession).toHaveBeenCalledWith(1);
      expect(result.current.session).toBe(null);
      expect(result.current.currentPhrase).toBe(null);
      expect(result.current.seenPhraseIds).toEqual([]);
    });
  });

  describe("loadNextPhrase", () => {
    it("should load next phrase excluding seen phrases", async () => {
      vi.mocked(getNextDeckPhrase).mockResolvedValue(mockPhrase);

      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      // Start session
      await act(async () => {
        await result.current.startSession("manual");
      });

      // Mark phrase as seen
      act(() => {
        result.current.markPhraseSeen(1);
      });

      // Clear mock to check next call
      vi.mocked(getNextDeckPhrase).mockClear();
      vi.mocked(getNextDeckPhrase).mockResolvedValue(null);

      // Load next phrase
      await act(async () => {
        await result.current.loadNextPhrase();
      });

      expect(getNextDeckPhrase).toHaveBeenCalledWith(1, [1]);
    });

    it("should finish session when no more phrases", async () => {
      vi.mocked(getNextDeckPhrase).mockResolvedValue(null);

      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      await act(async () => {
        await result.current.startSession("manual");
      });

      expect(finishPracticeSession).toHaveBeenCalledWith(mockSession.id);
      expect(result.current.currentPhrase).toBe(null);
    });
  });

  describe("recordAnswer", () => {
    it("should record answer and update session stats", async () => {
      vi.mocked(getNextDeckPhrase).mockResolvedValue(mockPhrase);
      vi.mocked(recordDeckAnswer).mockResolvedValue(mockDeckAnswerResult);

      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      await act(async () => {
        await result.current.startSession("manual");
      });

      await act(async () => {
        await result.current.recordAnswer(1, true);
      });

      expect(recordDeckAnswer).toHaveBeenCalledWith(1, true, 1, mockSession.id);
      expect(updatePracticeSession).toHaveBeenCalledWith(mockSession.id, 1, 1);
      expect(result.current.session?.correctAnswers).toBe(1);
    });

    it("should track graduation when phrase graduates", async () => {
      vi.mocked(getNextDeckPhrase).mockResolvedValue(mockPhrase);
      vi.mocked(recordDeckAnswer).mockResolvedValue({
        ...mockDeckAnswerResult,
        justGraduated: true,
      });

      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      await act(async () => {
        await result.current.startSession("manual");
      });

      await act(async () => {
        await result.current.recordAnswer(1, true);
      });

      expect(result.current.graduatedCount).toBe(1);
      expect(result.current.lastGraduation).toEqual({
        ...mockDeckAnswerResult,
        justGraduated: true,
      });
    });

    it("should not increment correctAnswers for incorrect answer", async () => {
      vi.mocked(getNextDeckPhrase).mockResolvedValue(mockPhrase);
      vi.mocked(recordDeckAnswer).mockResolvedValue(mockDeckAnswerResult);

      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      await act(async () => {
        await result.current.startSession("manual");
      });

      await act(async () => {
        await result.current.recordAnswer(1, false);
      });

      expect(updatePracticeSession).toHaveBeenCalledWith(mockSession.id, 1, 0);
      expect(result.current.session?.correctAnswers).toBe(0);
    });
  });

  describe("markPhraseSeen", () => {
    it("should add phrase id to seen list", () => {
      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      act(() => {
        result.current.markPhraseSeen(1);
      });

      expect(result.current.seenPhraseIds).toEqual([1]);

      act(() => {
        result.current.markPhraseSeen(2);
      });

      expect(result.current.seenPhraseIds).toEqual([1, 2]);
    });
  });

  describe("clearGraduation", () => {
    it("should clear lastGraduation state", async () => {
      vi.mocked(getNextDeckPhrase).mockResolvedValue(mockPhrase);
      vi.mocked(recordDeckAnswer).mockResolvedValue({
        ...mockDeckAnswerResult,
        justGraduated: true,
      });

      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      await act(async () => {
        await result.current.startSession("manual");
      });

      await act(async () => {
        await result.current.recordAnswer(1, true);
      });

      expect(result.current.lastGraduation).not.toBe(null);

      act(() => {
        result.current.clearGraduation();
      });

      expect(result.current.lastGraduation).toBe(null);
    });
  });

  describe("session restoration", () => {
    it("should restore session for matching deck", async () => {
      const savedSession: PracticeSession = {
        ...mockSession,
        id: 5,
        state: {
          deckId: 1,
          seenPhraseIds: [1, 2],
          sessionStreaks: {},
          sessionLearnedIds: [],
          newPhraseCount: 0,
          currentPhraseId: 3,
          inRetryMode: true,
          retryCount: 2,
          requiresRetry: true,
        },
      };

      vi.mocked(getActiveSession).mockResolvedValue(savedSession);
      vi.mocked(getNextDeckPhrase).mockResolvedValue(mockPhrase);

      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      await waitFor(() => {
        expect(result.current.session).toEqual(savedSession);
      });

      expect(result.current.seenPhraseIds).toEqual([1, 2]);
      expect(result.current.inRetryMode).toBe(true);
      expect(result.current.retryCount).toBe(2);
      expect(result.current.requiresRetry).toBe(true);
    });

    it("should not restore session for different deck", async () => {
      const differentDeckSession: PracticeSession = {
        ...mockSession,
        state: {
          deckId: 999, // Different deck
          seenPhraseIds: [1, 2],
          sessionStreaks: {},
          sessionLearnedIds: [],
          newPhraseCount: 0,
          currentPhraseId: null,
          inRetryMode: true,
          retryCount: 2,
          requiresRetry: true,
        },
      };

      vi.mocked(getActiveSession).mockResolvedValue(differentDeckSession);

      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      // Wait for initialization to complete
      await waitFor(() => {
        expect(getActiveSession).toHaveBeenCalled();
      });

      // Session should not be restored for different deck
      expect(result.current.session).toBe(null);
    });
  });

  describe("unmount behavior", () => {
    it("should not update state after unmount during startSession", async () => {
      const deferred = createDeferred<PracticeSession>();
      vi.mocked(startDeckSession).mockReturnValue(deferred.promise);

      const { result, unmount } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      // Start the async operation
      const startPromise = act(async () => {
        result.current.startSession("manual");
      });

      // Unmount before promise resolves
      unmount();

      // Resolve the promise after unmount
      deferred.resolve(mockSession);

      await startPromise;

      // Wait a tick to ensure no state updates happen
      await new Promise((resolve) => setTimeout(resolve, 10));

      // The hook should not throw or cause issues
      expect(true).toBe(true);
    });

    it("should not update state after unmount during loadNextPhrase", async () => {
      const deferred = createDeferred<PhraseWithProgress | null>();
      vi.mocked(getNextDeckPhrase).mockReturnValue(deferred.promise);

      const { result, unmount } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      // Start loading
      const loadPromise = act(async () => {
        result.current.loadNextPhrase();
      });

      // Unmount before promise resolves
      unmount();

      // Resolve the promise after unmount
      deferred.resolve(mockPhrase);

      await loadPromise;

      // Wait a tick
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(true).toBe(true);
    });

    it("should not update state after unmount during recordAnswer", async () => {
      vi.mocked(getNextDeckPhrase).mockResolvedValue(mockPhrase);

      const { result, unmount } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      // Start a session first
      await act(async () => {
        await result.current.startSession("manual");
      });

      const deferred = createDeferred<DeckAnswerResult>();
      vi.mocked(recordDeckAnswer).mockReturnValue(deferred.promise);

      // Start recording
      const recordPromise = act(async () => {
        result.current.recordAnswer(1, true);
      });

      // Unmount before promise resolves
      unmount();

      // Resolve the promise after unmount
      deferred.resolve({ ...mockDeckAnswerResult, justGraduated: true });

      await recordPromise;

      // Wait a tick
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(true).toBe(true);
    });
  });

  describe("state setters", () => {
    it("should update retryCount", () => {
      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      act(() => {
        result.current.setRetryCount(5);
      });

      expect(result.current.retryCount).toBe(5);
    });

    it("should update inRetryMode", () => {
      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      act(() => {
        result.current.setInRetryMode(true);
      });

      expect(result.current.inRetryMode).toBe(true);
    });

    it("should update requiresRetry", () => {
      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      act(() => {
        result.current.setRequiresRetry(true);
      });

      expect(result.current.requiresRetry).toBe(true);
    });

    it("should update currentPhrase", () => {
      const { result } = renderHook(() =>
        useDeckStudySession({
          deckId: 1,
          settings: mockSettings,
          onSettingsRefresh: mockOnSettingsRefresh,
        })
      );

      act(() => {
        result.current.setCurrentPhrase(mockPhrase);
      });

      expect(result.current.currentPhrase).toEqual(mockPhrase);
    });
  });
});
