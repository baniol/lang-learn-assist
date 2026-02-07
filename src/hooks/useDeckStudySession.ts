import { useState, useEffect, useCallback, useRef } from "react";
import {
  startDeckSession as apiStartDeckSession,
  getActiveSession,
  updatePracticeSession,
  finishPracticeSession,
  getNextDeckPhrase,
  recordDeckAnswer as apiRecordDeckAnswer,
} from "../api";
import type {
  PracticeSession,
  PhraseWithProgress,
  ExerciseMode,
  AppSettings,
  DeckAnswerResult,
} from "../types";

interface UseDeckStudySessionOptions {
  deckId: number;
  settings: AppSettings | null;
  onSettingsRefresh: () => Promise<void>;
}

interface UseDeckStudySessionResult {
  session: PracticeSession | null;
  currentPhrase: PhraseWithProgress | null;
  isLoading: boolean;
  seenPhraseIds: number[];
  graduatedCount: number;
  retryCount: number;
  inRetryMode: boolean;
  requiresRetry: boolean;
  lastGraduation: DeckAnswerResult | null;
  startSession: (mode: ExerciseMode) => Promise<void>;
  endSession: () => Promise<void>;
  loadNextPhrase: () => Promise<void>;
  recordAnswer: (phraseId: number, isCorrect: boolean) => Promise<DeckAnswerResult>;
  markPhraseSeen: (phraseId: number) => void;
  setRetryCount: (count: number) => void;
  setInRetryMode: (inRetry: boolean) => void;
  setRequiresRetry: (requires: boolean) => void;
  setCurrentPhrase: (phrase: PhraseWithProgress | null) => void;
  clearGraduation: () => void;
}

export function useDeckStudySession({
  deckId,
  settings,
  onSettingsRefresh,
}: UseDeckStudySessionOptions): UseDeckStudySessionResult {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState<PhraseWithProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [seenPhraseIds, setSeenPhraseIds] = useState<number[]>([]);
  const [graduatedCount, setGraduatedCount] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [inRetryMode, setInRetryMode] = useState(false);
  const [requiresRetry, setRequiresRetry] = useState(false);
  const [lastGraduation, setLastGraduation] = useState<DeckAnswerResult | null>(null);

  // Refs to track current values during async operations
  const sessionIdRef = useRef<number | null>(null);
  const seenPhraseIdsRef = useRef<number[]>([]);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    sessionIdRef.current = session?.id ?? null;
  }, [session?.id]);

  useEffect(() => {
    seenPhraseIdsRef.current = seenPhraseIds;
  }, [seenPhraseIds]);

  const loadNextPhraseInternal = useCallback(
    async (excludeIds: number[], sessionId?: number) => {
      const activeSessionId = sessionId ?? session?.id;

      setIsLoading(true);

      try {
        const phrase = await getNextDeckPhrase(
          deckId,
          excludeIds.length > 0 ? excludeIds : undefined
        );

        if (!mountedRef.current) return;

        setCurrentPhrase(phrase);

        if (!phrase && activeSessionId) {
          await finishPracticeSession(activeSessionId);
        }
      } catch (err) {
        console.error("Failed to load next deck phrase:", err);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [deckId, session?.id]
  );

  const restoreSession = useCallback(
    async (activeSession: PracticeSession) => {
      const state = activeSession.state;
      if (!state || state.deckId !== deckId) {
        // This session is for a different deck, start fresh
        return false;
      }

      if (!mountedRef.current) return false;

      setSession(activeSession);
      setSeenPhraseIds(state.seenPhraseIds);
      setInRetryMode(state.inRetryMode);
      setRetryCount(state.retryCount);
      setRequiresRetry(state.requiresRetry);

      if (state.currentPhraseId) {
        try {
          const phrase = await getNextDeckPhrase(
            deckId,
            state.seenPhraseIds.filter((id) => id !== state.currentPhraseId)
          );

          if (!mountedRef.current) return false;
          setCurrentPhrase(phrase);
        } catch (err) {
          console.error("Failed to restore current phrase:", err);
          if (mountedRef.current) {
            await loadNextPhraseInternal(state.seenPhraseIds, activeSession.id);
          }
        }
      } else {
        await loadNextPhraseInternal(state.seenPhraseIds, activeSession.id);
      }

      return true;
    },
    [deckId, loadNextPhraseInternal]
  );

  // Initialize - check for active session for this deck
  useEffect(() => {
    if (!settings) return;

    const initialize = async () => {
      try {
        const activeSession = await getActiveSession(settings.targetLanguage);
        if (!mountedRef.current) return;

        if (activeSession && activeSession.state?.deckId === deckId) {
          await restoreSession(activeSession);
        }
      } catch (err) {
        console.error("Failed to initialize deck study:", err);
      }
    };

    initialize();
  }, [settings, deckId, restoreSession]);

  const startSession = useCallback(
    async (mode: ExerciseMode) => {
      setIsLoading(true);
      try {
        await onSettingsRefresh();

        if (!mountedRef.current) return;

        const newSession = await apiStartDeckSession(deckId, mode);

        if (!mountedRef.current) return;

        setSession(newSession);
        setSeenPhraseIds([]);
        setGraduatedCount(0);
        setRetryCount(0);
        setInRetryMode(false);
        setRequiresRetry(false);
        setLastGraduation(null);
        await loadNextPhraseInternal([], newSession.id);
      } catch (err) {
        console.error("Failed to start deck session:", err);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [deckId, onSettingsRefresh, loadNextPhraseInternal]
  );

  const endSession = useCallback(async () => {
    if (session) {
      await finishPracticeSession(session.id);
    }

    if (!mountedRef.current) return;

    setSession(null);
    setCurrentPhrase(null);
    setSeenPhraseIds([]);
    setGraduatedCount(0);
    setRetryCount(0);
    setInRetryMode(false);
    setRequiresRetry(false);
    setLastGraduation(null);
  }, [session]);

  const loadNextPhrase = useCallback(async () => {
    await loadNextPhraseInternal(seenPhraseIds);
  }, [loadNextPhraseInternal, seenPhraseIds]);

  const recordAnswer = useCallback(
    async (phraseId: number, isCorrect: boolean): Promise<DeckAnswerResult> => {
      // Call backend with deck-specific recording
      const result = await apiRecordDeckAnswer(phraseId, isCorrect, deckId, session?.id);

      if (!mountedRef.current) return result;

      // Check for graduation
      if (result.justGraduated) {
        setLastGraduation(result);
        setGraduatedCount((prev) => prev + 1);
      }

      // Update session stats
      if (session) {
        const currentSeenCount = seenPhraseIdsRef.current.length;
        const newCorrectAnswers = isCorrect
          ? (session.correctAnswers || 0) + 1
          : session.correctAnswers || 0;

        await updatePracticeSession(
          session.id,
          currentSeenCount + 1,
          newCorrectAnswers
        );

        if (!mountedRef.current) return result;

        setSession((prev) =>
          prev
            ? {
                ...prev,
                totalPhrases: currentSeenCount + 1,
                correctAnswers: newCorrectAnswers,
              }
            : null
        );
      }

      return result;
    },
    [deckId, session]
  );

  const markPhraseSeen = useCallback((phraseId: number) => {
    setSeenPhraseIds((prev) => [...prev, phraseId]);
  }, []);

  const clearGraduation = useCallback(() => {
    setLastGraduation(null);
  }, []);

  return {
    session,
    currentPhrase,
    isLoading,
    seenPhraseIds,
    graduatedCount,
    retryCount,
    inRetryMode,
    requiresRetry,
    lastGraduation,
    startSession,
    endSession,
    loadNextPhrase,
    recordAnswer,
    markPhraseSeen,
    setRetryCount,
    setInRetryMode,
    setRequiresRetry,
    setCurrentPhrase,
    clearGraduation,
  };
}
