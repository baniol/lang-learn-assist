import { useState, useEffect, useCallback, useRef } from "react";
import {
  startPracticeSession as apiStartSession,
  getActiveSession,
  updatePracticeSession,
  finishPracticeSession,
  getNextPhrase,
  recordAnswer as apiRecordAnswer,
} from "../api";
import type {
  PracticeSession,
  PhraseWithProgress,
  ExerciseMode,
  AppSettings,
  AnswerResult,
} from "../types";

interface UsePracticeSessionOptions {
  settings: AppSettings | null;
  onSettingsRefresh: () => Promise<void>;
}

interface UsePracticeSessionResult {
  session: PracticeSession | null;
  currentPhrase: PhraseWithProgress | null;
  isLoading: boolean;
  seenPhraseIds: number[];
  sessionLearnedCount: number;
  newPhraseCount: number;
  retryCount: number;
  inRetryMode: boolean;
  requiresRetry: boolean;
  startSession: (mode: ExerciseMode) => Promise<void>;
  endSession: () => Promise<void>;
  loadNextPhrase: () => Promise<void>;
  recordAnswer: (phraseId: number, isCorrect: boolean) => Promise<AnswerResult>;
  markPhraseSeen: (phraseId: number) => void;
  setRetryCount: (count: number) => void;
  setInRetryMode: (inRetry: boolean) => void;
  setRequiresRetry: (requires: boolean) => void;
  setCurrentPhrase: (phrase: PhraseWithProgress | null) => void;
}

export function usePracticeSession({
  settings,
  onSettingsRefresh,
}: UsePracticeSessionOptions): UsePracticeSessionResult {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState<PhraseWithProgress | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [seenPhraseIds, setSeenPhraseIds] = useState<number[]>([]);
  const [sessionLearnedCount, setSessionLearnedCount] = useState(0);
  const [newPhraseCount, setNewPhraseCount] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [inRetryMode, setInRetryMode] = useState(false);
  const [requiresRetry, setRequiresRetry] = useState(false);

  // Refs to track current values during async operations
  const sessionIdRef = useRef<number | null>(null);
  const seenPhraseIdsRef = useRef<number[]>([]);
  const settingsRef = useRef<AppSettings | null>(settings);

  useEffect(() => {
    sessionIdRef.current = session?.id ?? null;
  }, [session?.id]);

  useEffect(() => {
    seenPhraseIdsRef.current = seenPhraseIds;
  }, [seenPhraseIds]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const loadNextPhraseInternal = useCallback(
    async (
      excludeIds: number[],
      currentNewCount: number,
      sessionId?: number
    ) => {
      const activeSessionId = sessionId ?? session?.id;
      // Use ref to get latest settings (avoids stale closure after settings refresh)
      const currentSettings = settingsRef.current;

      if (
        currentSettings &&
        currentSettings.sessionPhraseLimit > 0 &&
        excludeIds.length >= currentSettings.sessionPhraseLimit
      ) {
        setCurrentPhrase(null);
        if (activeSessionId) {
          await finishPracticeSession(activeSessionId);
        }
        return;
      }

      setIsLoading(true);

      try {
        const phrase = await getNextPhrase({
          targetLanguage: currentSettings?.targetLanguage,
          excludeIds: excludeIds.length > 0 ? excludeIds : undefined,
          newPhraseCount: currentNewCount,
          newPhraseLimit: currentSettings?.newPhrasesPerSession ?? 0,
        });
        setCurrentPhrase(phrase);

        if (phrase) {
          const isNew = !phrase.progress || phrase.progress.totalAttempts === 0;
          if (isNew) {
            setNewPhraseCount(currentNewCount + 1);
          }
        } else {
          if (activeSessionId) {
            await finishPracticeSession(activeSessionId);
          }
        }
      } catch (err) {
        console.error("Failed to load next phrase:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [session?.id]
  );

  const restoreSession = useCallback(
    async (activeSession: PracticeSession) => {
      const currentSettings = settingsRef.current;
      if (!currentSettings) return;

      const state = activeSession.state;
      if (!state) {
        setSession(activeSession);
        await loadNextPhraseInternal([], 0, activeSession.id);
        return;
      }

      setSession(activeSession);
      setSeenPhraseIds(state.seenPhraseIds);
      setSessionLearnedCount(state.sessionLearnedIds.length);
      setNewPhraseCount(state.newPhraseCount);
      setInRetryMode(state.inRetryMode);
      setRetryCount(state.retryCount);
      setRequiresRetry(state.requiresRetry);

      if (state.currentPhraseId) {
        try {
          const phrase = await getNextPhrase({
            targetLanguage: currentSettings.targetLanguage,
            excludeIds: state.seenPhraseIds.filter(
              (id) => id !== state.currentPhraseId
            ),
            newPhraseCount: state.newPhraseCount,
            newPhraseLimit: currentSettings.newPhrasesPerSession ?? 0,
          });
          setCurrentPhrase(phrase);
        } catch (err) {
          console.error("Failed to restore current phrase:", err);
          await loadNextPhraseInternal(
            state.seenPhraseIds,
            state.newPhraseCount,
            activeSession.id
          );
        }
      } else {
        await loadNextPhraseInternal(
          state.seenPhraseIds,
          state.newPhraseCount,
          activeSession.id
        );
      }
    },
    [loadNextPhraseInternal]
  );

  // Initialize - check for active session
  useEffect(() => {
    if (!settings) return;

    const initialize = async () => {
      try {
        const activeSession = await getActiveSession(settings.targetLanguage);
        if (activeSession) {
          await restoreSession(activeSession);
        }
      } catch (err) {
        console.error("Failed to initialize:", err);
      }
    };

    initialize();
  }, [settings, restoreSession]);

  const startSession = useCallback(
    async (mode: ExerciseMode) => {
      setIsLoading(true);
      try {
        await onSettingsRefresh();

        const newSession = await apiStartSession(mode);
        setSession(newSession);
        setSeenPhraseIds([]);
        setSessionLearnedCount(0);
        setRetryCount(0);
        setInRetryMode(false);
        setNewPhraseCount(0);
        setRequiresRetry(false);
        await loadNextPhraseInternal([], 0, newSession.id);
      } catch (err) {
        console.error("Failed to start session:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [onSettingsRefresh, loadNextPhraseInternal]
  );

  const endSession = useCallback(async () => {
    if (session) {
      await finishPracticeSession(session.id);
    }
    setSession(null);
    setCurrentPhrase(null);
    setSeenPhraseIds([]);
    setSessionLearnedCount(0);
    setRetryCount(0);
    setInRetryMode(false);
    setNewPhraseCount(0);
    setRequiresRetry(false);
  }, [session]);

  const loadNextPhrase = useCallback(async () => {
    await loadNextPhraseInternal(seenPhraseIds, newPhraseCount);
  }, [loadNextPhraseInternal, seenPhraseIds, newPhraseCount]);

  const recordAnswer = useCallback(
    async (phraseId: number, isCorrect: boolean): Promise<AnswerResult> => {
      // Call backend with session_id - it handles streak tracking
      const result = await apiRecordAnswer(phraseId, isCorrect, session?.id);

      // Update session stats using ref for current count
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

        setSession((prev) =>
          prev
            ? {
                ...prev,
                totalPhrases: currentSeenCount + 1,
                correctAnswers: newCorrectAnswers,
              }
            : null
        );

        // Update learned count from backend
        const updatedSession = await getActiveSession(settings?.targetLanguage);
        if (updatedSession?.state) {
          setSessionLearnedCount(updatedSession.state.sessionLearnedIds.length);
        }
      }

      return result;
    },
    [session, settings?.targetLanguage]
  );

  const markPhraseSeen = useCallback((phraseId: number) => {
    setSeenPhraseIds((prev) => [...prev, phraseId]);
  }, []);

  return {
    session,
    currentPhrase,
    isLoading,
    seenPhraseIds,
    sessionLearnedCount,
    newPhraseCount,
    retryCount,
    inRetryMode,
    requiresRetry,
    startSession,
    endSession,
    loadNextPhrase,
    recordAnswer,
    markPhraseSeen,
    setRetryCount,
    setInRetryMode,
    setRequiresRetry,
    setCurrentPhrase,
  };
}
