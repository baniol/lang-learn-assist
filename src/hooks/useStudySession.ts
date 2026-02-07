import { useState, useEffect, useCallback, useRef } from "react";
import {
  startDeckSession,
  startPracticeSession,
  getActiveSession,
  updatePracticeSession,
  finishPracticeSession,
  getStudyPhrase,
  recordStudyAnswer,
} from "../api";
import type {
  PracticeSession,
  PhraseWithProgress,
  ExerciseMode,
  AppSettings,
  StudyAnswerResult,
  StudyModeType,
} from "../types";

interface UseStudySessionOptions {
  mode: StudyModeType;
  settings: AppSettings | null;
  onSettingsRefresh: () => Promise<void>;
}

interface UseStudySessionResult {
  session: PracticeSession | null;
  currentPhrase: PhraseWithProgress | null;
  isLoading: boolean;
  seenPhraseIds: number[];
  // Deck-specific
  graduatedCount: number;
  // SRS-specific
  sessionLearnedCount: number;
  newPhraseCount: number;
  // Retry mode
  retryCount: number;
  inRetryMode: boolean;
  requiresRetry: boolean;
  // Last answer result
  lastAnswerResult: StudyAnswerResult | null;
  // Actions
  startSession: (exerciseMode: ExerciseMode) => Promise<void>;
  endSession: () => Promise<void>;
  loadNextPhrase: () => Promise<void>;
  recordAnswer: (phraseId: number, isCorrect: boolean) => Promise<StudyAnswerResult>;
  markPhraseSeen: (phraseId: number) => void;
  setRetryCount: (count: number) => void;
  setInRetryMode: (inRetry: boolean) => void;
  setRequiresRetry: (requires: boolean) => void;
  setCurrentPhrase: (phrase: PhraseWithProgress | null) => void;
  clearLastAnswer: () => void;
}

export function useStudySession({
  mode,
  settings,
  onSettingsRefresh,
}: UseStudySessionOptions): UseStudySessionResult {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState<PhraseWithProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [seenPhraseIds, setSeenPhraseIds] = useState<number[]>([]);
  const [graduatedCount, setGraduatedCount] = useState(0);
  const [sessionLearnedCount, setSessionLearnedCount] = useState(0);
  const [newPhraseCount, setNewPhraseCount] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [inRetryMode, setInRetryMode] = useState(false);
  const [requiresRetry, setRequiresRetry] = useState(false);
  const [lastAnswerResult, setLastAnswerResult] = useState<StudyAnswerResult | null>(null);

  // Refs to track current values during async operations
  const sessionIdRef = useRef<number | null>(null);
  const seenPhraseIdsRef = useRef<number[]>([]);
  const mountedRef = useRef(true);
  const settingsRef = useRef<AppSettings | null>(settings);

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

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const isDeckMode = mode.type === "deck_learning";
  const deckId = isDeckMode ? (mode as { type: "deck_learning"; deckId: number }).deckId : null;

  const loadNextPhraseInternal = useCallback(
    async (excludeIds: number[], currentNewCount: number, sessionId?: number) => {
      const activeSessionId = sessionId ?? session?.id;
      const currentSettings = settingsRef.current;

      // For SRS mode, check session phrase limit
      if (
        !isDeckMode &&
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
        const phrase = await getStudyPhrase(mode, {
          excludeIds: excludeIds.length > 0 ? excludeIds : undefined,
          newPhraseCount: currentNewCount,
          newPhraseLimit: currentSettings?.newPhrasesPerSession ?? 0,
          sessionPosition: excludeIds.length,
          newPhraseInterval: currentSettings?.newPhraseInterval ?? 4,
          targetLanguage: currentSettings?.targetLanguage,
        });

        if (!mountedRef.current) return;

        setCurrentPhrase(phrase);

        if (phrase) {
          // Track new phrases for SRS mode
          if (!isDeckMode) {
            const isNew = !phrase.progress || phrase.progress.totalAttempts === 0;
            if (isNew) {
              setNewPhraseCount(currentNewCount + 1);
            }
          }
        } else {
          if (activeSessionId) {
            await finishPracticeSession(activeSessionId);
          }
        }
      } catch (err) {
        console.error("Failed to load next phrase:", err);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [mode, isDeckMode, session?.id]
  );

  const restoreSession = useCallback(
    async (activeSession: PracticeSession) => {
      const state = activeSession.state;

      // For deck mode, check if session matches the deck
      if (isDeckMode && state?.deckId !== deckId) {
        return false;
      }

      // For SRS mode, check if it's not a deck session
      if (!isDeckMode && state?.deckId) {
        return false;
      }

      if (!state) {
        setSession(activeSession);
        await loadNextPhraseInternal([], 0, activeSession.id);
        return true;
      }

      if (!mountedRef.current) return false;

      setSession(activeSession);
      setSeenPhraseIds(state.seenPhraseIds);
      setSessionLearnedCount(state.sessionLearnedIds?.length || 0);
      setNewPhraseCount(state.newPhraseCount || 0);
      setInRetryMode(state.inRetryMode);
      setRetryCount(state.retryCount);
      setRequiresRetry(state.requiresRetry);

      if (state.currentPhraseId) {
        try {
          const phrase = await getStudyPhrase(mode, {
            excludeIds: state.seenPhraseIds.filter((id) => id !== state.currentPhraseId),
            newPhraseCount: state.newPhraseCount || 0,
            newPhraseLimit: settingsRef.current?.newPhrasesPerSession ?? 0,
            sessionPosition: state.seenPhraseIds.length,
            newPhraseInterval: settingsRef.current?.newPhraseInterval ?? 4,
            targetLanguage: settingsRef.current?.targetLanguage,
          });

          if (!mountedRef.current) return false;
          setCurrentPhrase(phrase);
        } catch (err) {
          console.error("Failed to restore current phrase:", err);
          if (mountedRef.current) {
            await loadNextPhraseInternal(state.seenPhraseIds, state.newPhraseCount || 0, activeSession.id);
          }
        }
      } else {
        await loadNextPhraseInternal(state.seenPhraseIds, state.newPhraseCount || 0, activeSession.id);
      }

      return true;
    },
    [mode, isDeckMode, deckId, loadNextPhraseInternal]
  );

  // Initialize - check for active session
  useEffect(() => {
    if (!settings) return;

    const initialize = async () => {
      try {
        const activeSession = await getActiveSession(settings.targetLanguage);
        if (!mountedRef.current) return;

        if (activeSession) {
          const restored = await restoreSession(activeSession);
          if (!restored) {
            // Session is for different mode, don't restore
          }
        }
      } catch (err) {
        console.error("Failed to initialize study session:", err);
      }
    };

    initialize();
  }, [settings, restoreSession]);

  const startSession = useCallback(
    async (exerciseMode: ExerciseMode) => {
      setIsLoading(true);
      try {
        await onSettingsRefresh();

        if (!mountedRef.current) return;

        const newSession = isDeckMode
          ? await startDeckSession(deckId!, exerciseMode)
          : await startPracticeSession(exerciseMode);

        if (!mountedRef.current) return;

        setSession(newSession);
        setSeenPhraseIds([]);
        setGraduatedCount(0);
        setSessionLearnedCount(0);
        setNewPhraseCount(0);
        setRetryCount(0);
        setInRetryMode(false);
        setRequiresRetry(false);
        setLastAnswerResult(null);
        await loadNextPhraseInternal([], 0, newSession.id);
      } catch (err) {
        console.error("Failed to start session:", err);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [isDeckMode, deckId, onSettingsRefresh, loadNextPhraseInternal]
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
    setSessionLearnedCount(0);
    setNewPhraseCount(0);
    setRetryCount(0);
    setInRetryMode(false);
    setRequiresRetry(false);
    setLastAnswerResult(null);
  }, [session]);

  const loadNextPhrase = useCallback(async () => {
    await loadNextPhraseInternal(seenPhraseIds, newPhraseCount);
  }, [loadNextPhraseInternal, seenPhraseIds, newPhraseCount]);

  const recordAnswer = useCallback(
    async (phraseId: number, isCorrect: boolean): Promise<StudyAnswerResult> => {
      const result = await recordStudyAnswer(phraseId, isCorrect, mode, session?.id);

      if (!mountedRef.current) return result;

      setLastAnswerResult(result);

      // Handle deck graduation
      if (result.justGraduated) {
        setGraduatedCount((prev) => prev + 1);
      }

      // Handle SRS session learning
      if (result.isLearnedInSession) {
        setSessionLearnedCount((prev) => prev + 1);
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
    [mode, session]
  );

  const markPhraseSeen = useCallback((phraseId: number) => {
    setSeenPhraseIds((prev) => [...prev, phraseId]);
  }, []);

  const clearLastAnswer = useCallback(() => {
    setLastAnswerResult(null);
  }, []);

  return {
    session,
    currentPhrase,
    isLoading,
    seenPhraseIds,
    graduatedCount,
    sessionLearnedCount,
    newPhraseCount,
    retryCount,
    inRetryMode,
    requiresRetry,
    lastAnswerResult,
    startSession,
    endSession,
    loadNextPhrase,
    recordAnswer,
    markPhraseSeen,
    setRetryCount,
    setInRetryMode,
    setRequiresRetry,
    setCurrentPhrase,
    clearLastAnswer,
  };
}
