import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VoiceButton } from "../components/VoiceButton";
import { PhraseRefinementDialog } from "../components/PhraseRefinementDialog";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useTTS } from "../hooks/useTTS";
import { useSettings } from "../contexts/SettingsContext";
import { Button, Spinner } from "../components/ui";
import {
  PlayIcon,
  CheckCircleIcon,
  CalendarIcon,
  ExcludeIcon,
  LightbulbIcon,
} from "../components/icons";
import type {
  PhraseWithProgress,
  LearningStats,
  ExerciseMode,
  PracticeSession,
  Phrase,
  UpdatePhraseRequest,
} from "../types";

export function LearnView() {
  const { settings, refreshSettings } = useSettings();
  const [mode, setMode] = useState<ExerciseMode>("manual");
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState<PhraseWithProgress | null>(
    null,
  );
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [inputAnswer, setInputAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(
    null,
  );
  const [seenPhraseIds, setSeenPhraseIds] = useState<number[]>([]);
  const [requiresRetry, setRequiresRetry] = useState(false);

  // Session-based progress per phrase: { phraseId: sessionStreak }
  const [sessionStreaks, setSessionStreaks] = useState<Record<number, number>>(
    {},
  );

  // Phrases learned in this session (reached requiredStreak)
  const [sessionLearnedIds, setSessionLearnedIds] = useState<Set<number>>(
    new Set(),
  );

  // For speak mode retry: how many correct retries done after last failure
  const [retryCount, setRetryCount] = useState(0);

  // Track how many new phrases have been introduced this session
  const [newPhraseCount, setNewPhraseCount] = useState(0);

  // Whether in retry mode (speak mode only, after wrong answer)
  const [inRetryMode, setInRetryMode] = useState(false);

  // Whether awaiting user to proceed after correct answer (Space key)
  const [awaitingProceed, setAwaitingProceed] = useState(false);

  // For opening the phrase refinement dialog when answer is rejected
  const [refiningPhrase, setRefiningPhrase] = useState<{
    phrase: Phrase;
    userAnswer: string;
  } | null>(null);

  const handleAudioGenerated = useCallback(
    async (phraseId: number, audioPath: string) => {
      try {
        await invoke("update_phrase_audio", { id: phraseId, audioPath });
        // Update current phrase if it matches
        if (currentPhrase?.phrase.id === phraseId) {
          setCurrentPhrase((prev) =>
            prev ? { ...prev, phrase: { ...prev.phrase, audioPath } } : null,
          );
        }
      } catch (err) {
        console.error("Failed to save audio path:", err);
      }
    },
    [currentPhrase?.phrase.id],
  );

  const tts = useTTS({
    enabled: true,
    onError: (err) => console.error("TTS error:", err),
    onAudioGenerated: handleAudioGenerated,
  });

  // Use the current phrase's language or settings language for voice recording
  const voiceLanguage =
    currentPhrase?.phrase.targetLanguage || settings?.targetLanguage || "de";

  const voiceRecording = useVoiceRecording({
    enabled: mode === "speaking",
    language: voiceLanguage,
    // Pass expected phrase as hint to Whisper for better transcription accuracy
    prompt: currentPhrase?.phrase.answer,
    onTranscription: (text) => {
      setInputAnswer(text);
      handleCheckAnswer(text);
    },
    onError: (err) => console.error("Voice error:", err),
    disableSpaceKey: awaitingProceed,
  });

  // Track state in refs so cleanup can access without stale closures
  const sessionIdRef = useRef<number | null>(null);
  const stateRef = useRef<{
    seenPhraseIds: number[];
    sessionStreaks: Record<number, number>;
    sessionLearnedIds: number[];
    newPhraseCount: number;
    currentPhraseId: number | null;
    inRetryMode: boolean;
    retryCount: number;
    requiresRetry: boolean;
  } | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    sessionIdRef.current = session?.id ?? null;
  }, [session?.id]);

  useEffect(() => {
    if (session) {
      stateRef.current = {
        seenPhraseIds,
        sessionStreaks,
        sessionLearnedIds: Array.from(sessionLearnedIds),
        newPhraseCount,
        currentPhraseId: currentPhrase?.phrase.id ?? null,
        inRetryMode,
        retryCount,
        requiresRetry,
      };
    } else {
      stateRef.current = null;
    }
  }, [
    session,
    seenPhraseIds,
    sessionStreaks,
    sessionLearnedIds,
    newPhraseCount,
    currentPhrase,
    inRetryMode,
    retryCount,
    requiresRetry,
  ]);

  // Save session state (called when state changes or on unmount)
  const saveSessionState = useCallback(async () => {
    if (!sessionIdRef.current || !stateRef.current) return;
    try {
      await invoke("save_session_state", {
        sessionId: sessionIdRef.current,
        state: stateRef.current,
      });
    } catch (err) {
      console.error("Failed to save session state:", err);
    }
  }, []);

  // Cleanup: save session state when navigating away (don't finish it)
  useEffect(() => {
    return () => {
      if (sessionIdRef.current && stateRef.current) {
        // Save state synchronously as best effort on unmount
        invoke("save_session_state", {
          sessionId: sessionIdRef.current,
          state: stateRef.current,
        }).catch((err) =>
          console.error("Failed to save session state on unmount:", err),
        );
      }
    };
  }, []);

  // Auto-save session state when important fields change
  useEffect(() => {
    if (!session) return;

    // Debounce to avoid too many saves
    const timeoutId = setTimeout(() => {
      saveSessionState();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    session,
    seenPhraseIds,
    sessionStreaks,
    sessionLearnedIds,
    newPhraseCount,
    currentPhrase?.phrase.id,
    inRetryMode,
    retryCount,
    requiresRetry,
    saveSessionState,
  ]);

  // Restore session from saved state
  const restoreSession = useCallback(
    async (activeSession: PracticeSession) => {
      if (!settings) return;

      const state = activeSession.state;
      if (!state) {
        // Session exists but has no state - treat as fresh session
        setSession(activeSession);
        setMode(activeSession.exerciseMode as ExerciseMode);
        await loadNextPhrase([], 0, activeSession.id);
        return;
      }

      // Restore all state from saved session
      setSession(activeSession);
      setMode(activeSession.exerciseMode as ExerciseMode);
      setSeenPhraseIds(state.seenPhraseIds);
      setSessionStreaks(state.sessionStreaks);
      setSessionLearnedIds(new Set(state.sessionLearnedIds));
      setNewPhraseCount(state.newPhraseCount);
      setInRetryMode(state.inRetryMode);
      setRetryCount(state.retryCount);
      setRequiresRetry(state.requiresRetry);

      // Load the current phrase if there was one
      if (state.currentPhraseId) {
        try {
          const phrase = await invoke<PhraseWithProgress | null>(
            "get_next_phrase",
            {
              targetLanguage: settings.targetLanguage || null,
              excludeIds: state.seenPhraseIds.filter(
                (id) => id !== state.currentPhraseId,
              ),
              newPhraseCount: state.newPhraseCount,
              newPhraseLimit: settings.newPhrasesPerSession ?? 0,
            },
          );
          setCurrentPhrase(phrase);
        } catch (err) {
          console.error("Failed to restore current phrase:", err);
          // Fall back to loading next phrase
          await loadNextPhrase(
            state.seenPhraseIds,
            state.newPhraseCount,
            activeSession.id,
          );
        }
      } else {
        // No current phrase, load next one
        await loadNextPhrase(
          state.seenPhraseIds,
          state.newPhraseCount,
          activeSession.id,
        );
      }
    },
    [settings],
  );

  useEffect(() => {
    // Initialize when settings are available
    if (!settings) return;

    const initialize = async () => {
      try {
        setMode(settings.defaultExerciseMode);
        loadStats(settings.targetLanguage);

        // Check for active (unfinished) session
        const activeSession = await invoke<PracticeSession | null>(
          "get_active_session",
          {
            targetLanguage: settings.targetLanguage,
          },
        );

        if (activeSession) {
          // Restore the active session
          await restoreSession(activeSession);
        }
      } catch (err) {
        console.error("Failed to initialize:", err);
      }
    };

    initialize();
  }, [settings, restoreSession]);

  const loadStats = async (targetLanguage?: string) => {
    try {
      const data = await invoke<LearningStats>("get_learning_stats", {
        targetLanguage: targetLanguage || settings?.targetLanguage || null,
      });
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const startSession = async () => {
    setIsLoading(true);
    try {
      // Refresh settings to ensure we have latest values
      await refreshSettings();

      const newSession = await invoke<PracticeSession>(
        "start_practice_session",
        {
          exerciseMode: mode,
        },
      );
      setSession(newSession);
      setSeenPhraseIds([]);
      // Reset session-based state
      setSessionStreaks({});
      setSessionLearnedIds(new Set());
      setRetryCount(0);
      setInRetryMode(false);
      setAwaitingProceed(false);
      setNewPhraseCount(0);
      await loadNextPhrase([], 0);
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadNextPhrase = async (
    excludeIds: number[],
    currentNewCount: number,
    sessionId?: number,
  ) => {
    const activeSessionId = sessionId ?? session?.id;

    // Check if session limit reached
    if (
      settings &&
      settings.sessionPhraseLimit > 0 &&
      excludeIds.length >= settings.sessionPhraseLimit
    ) {
      setCurrentPhrase(null);
      if (activeSessionId) {
        await invoke("finish_practice_session", { sessionId: activeSessionId });
      }
      return;
    }

    setIsLoading(true);
    setShowAnswer(false);
    setInputAnswer("");
    setFeedback(null);
    setAwaitingProceed(false);

    try {
      const phrase = await invoke<PhraseWithProgress | null>(
        "get_next_phrase",
        {
          targetLanguage: settings?.targetLanguage || null,
          excludeIds: excludeIds.length > 0 ? excludeIds : null,
          newPhraseCount: currentNewCount,
          newPhraseLimit: settings?.newPhrasesPerSession ?? 0,
        },
      );
      setCurrentPhrase(phrase);

      if (phrase) {
        // Check if this phrase is new (no progress or never attempted)
        const isNew = !phrase.progress || phrase.progress.totalAttempts === 0;
        if (isNew) {
          setNewPhraseCount(currentNewCount + 1);
        }
      } else {
        // No more phrases
        if (activeSessionId) {
          await invoke("finish_practice_session", {
            sessionId: activeSessionId,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load next phrase:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckAnswer = useCallback(
    async (answer?: string) => {
      if (!currentPhrase || !settings) return;

      const answerToCheck = answer || inputAnswer;
      if (!answerToCheck.trim()) return;

      const phraseId = currentPhrase.phrase.id;

      try {
        const isCorrect = await invoke<boolean>("validate_answer", {
          phraseId,
          input: answerToCheck,
        });

        setFeedback(isCorrect ? "correct" : "incorrect");

        if (isCorrect) {
          if (inRetryMode && mode === "speaking") {
            // Retry attempt - increment count, check if done
            const newRetryCount = retryCount + 1;
            setRetryCount(newRetryCount);

            if (newRetryCount >= settings.failureRepetitions) {
              // Done with retries, can advance (but streak stays at 0)
              setInRetryMode(false);
              setRetryCount(0);
              setRequiresRetry(false);
              // Show correct answer and wait for user to proceed (Space key)
              setAwaitingProceed(true);
            } else {
              // More retries needed - clear feedback after delay to let user try again
              setTimeout(() => {
                setFeedback(null);
                setInputAnswer("");
              }, 1500);
            }
            // Don't call record_answer or update session during retries
          } else {
            // Normal correct answer - update session streak
            const currentStreak = sessionStreaks[phraseId] || 0;
            const newStreak = currentStreak + 1;
            setSessionStreaks((prev) => ({ ...prev, [phraseId]: newStreak }));

            if (newStreak >= settings.requiredStreak) {
              setSessionLearnedIds((prev) => new Set([...prev, phraseId]));
            }

            // Call record_answer for SRS
            await invoke("record_answer", {
              phraseId,
              isCorrect: true,
            });

            if (session) {
              await invoke("update_practice_session", {
                sessionId: session.id,
                totalPhrases: seenPhraseIds.length + 1,
                correctAnswers: (session.correctAnswers || 0) + 1,
              });
              setSession((prev) =>
                prev
                  ? {
                      ...prev,
                      totalPhrases: seenPhraseIds.length + 1,
                      correctAnswers: (prev.correctAnswers || 0) + 1,
                    }
                  : null,
              );
            }

            setRequiresRetry(false);
            // Show correct answer and wait for user to proceed (Space key)
            setAwaitingProceed(true);
          }
        } else {
          // Incorrect answer
          // Reset session streak for this phrase
          setSessionStreaks((prev) => ({ ...prev, [phraseId]: 0 }));
          setSessionLearnedIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(phraseId);
            return newSet;
          });

          // Call record_answer for SRS
          await invoke("record_answer", {
            phraseId,
            isCorrect: false,
          });

          if (session) {
            await invoke("update_practice_session", {
              sessionId: session.id,
              totalPhrases: seenPhraseIds.length + 1,
              correctAnswers: session.correctAnswers || 0,
            });
            setSession((prev) =>
              prev
                ? {
                    ...prev,
                    totalPhrases: seenPhraseIds.length + 1,
                  }
                : null,
            );
          }

          if (mode === "speaking") {
            // Enter retry mode
            setInRetryMode(true);
            setRetryCount(0);
          }
          setRequiresRetry(true);
          // On incorrect: keep feedback visible, user clicks "Try Again" (or speaks again in retry mode)
        }
      } catch (err) {
        console.error("Failed to check answer:", err);
      }
    },
    [
      currentPhrase,
      inputAnswer,
      session,
      seenPhraseIds,
      settings,
      mode,
      inRetryMode,
      retryCount,
      sessionStreaks,
    ],
  );

  const handleManualAnswer = async (isCorrect: boolean) => {
    if (!currentPhrase || !settings) return;

    const phraseId = currentPhrase.phrase.id;
    setFeedback(isCorrect ? "correct" : "incorrect");

    try {
      // Update session streak
      if (isCorrect) {
        const currentStreak = sessionStreaks[phraseId] || 0;
        const newStreak = currentStreak + 1;
        setSessionStreaks((prev) => ({ ...prev, [phraseId]: newStreak }));

        if (newStreak >= settings.requiredStreak) {
          setSessionLearnedIds((prev) => new Set([...prev, phraseId]));
        }
      } else {
        // Reset session streak
        setSessionStreaks((prev) => ({ ...prev, [phraseId]: 0 }));
        setSessionLearnedIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(phraseId);
          return newSet;
        });
      }

      await invoke("record_answer", {
        phraseId,
        isCorrect,
      });

      if (session) {
        await invoke("update_practice_session", {
          sessionId: session.id,
          totalPhrases: seenPhraseIds.length + 1,
          correctAnswers: (session.correctAnswers || 0) + (isCorrect ? 1 : 0),
        });
        setSession((prev) =>
          prev
            ? {
                ...prev,
                totalPhrases: seenPhraseIds.length + 1,
                correctAnswers:
                  (prev.correctAnswers || 0) + (isCorrect ? 1 : 0),
              }
            : null,
        );
      }

      // Show correct answer and wait for user to proceed (Space key)
      setAwaitingProceed(true);
    } catch (err) {
      console.error("Failed to record answer:", err);
    }
  };

  const handlePlayAnswer = useCallback(() => {
    if (!currentPhrase) return;
    tts.speak(
      currentPhrase.phrase.answer,
      currentPhrase.phrase.id,
      currentPhrase.phrase.audioPath || undefined,
      currentPhrase.phrase.targetLanguage,
    );
  }, [currentPhrase, tts]);

  const handleProceedToNext = useCallback(() => {
    if (!currentPhrase || !awaitingProceed) return;
    const phraseId = currentPhrase.phrase.id;
    const newSeenIds = [...seenPhraseIds, phraseId];
    setSeenPhraseIds(newSeenIds);
    setAwaitingProceed(false);
    loadNextPhrase(newSeenIds, newPhraseCount);
  }, [currentPhrase, awaitingProceed, seenPhraseIds, newPhraseCount, settings]);

  // Keyboard listener for Space (proceed) and P (playback)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (awaitingProceed) {
        if (e.code === "Space") {
          e.preventDefault();
          handleProceedToNext();
        } else if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          handlePlayAnswer();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [awaitingProceed, handleProceedToNext, handlePlayAnswer]);

  const endSession = async () => {
    if (session) {
      await invoke("finish_practice_session", { sessionId: session.id });
    }
    const targetLang = settings?.targetLanguage;
    setSession(null);
    setCurrentPhrase(null);
    setSeenPhraseIds([]);
    // Clear session-based state
    setSessionStreaks({});
    setSessionLearnedIds(new Set());
    setRetryCount(0);
    setInRetryMode(false);
    setAwaitingProceed(false);
    setNewPhraseCount(0);
    loadStats(targetLang);
  };

  // Not in a session - show stats and start options
  if (!session) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
          Learn
        </h1>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {stats.totalPhrases}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 p-4 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.learnedCount}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Learned
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.learningCount}
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Learning
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-4 text-center">
              <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">
                {stats.newCount}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">New</p>
            </div>
          </div>
        )}

        {/* Mode Selection */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
            Exercise Mode
          </h2>
          <div className="space-y-3">
            {(
              [
                {
                  id: "manual",
                  label: "Manual",
                  desc: "Reveal answer and self-grade",
                },
                {
                  id: "typing",
                  label: "Typing",
                  desc: "Type the answer in German",
                },
                {
                  id: "speaking",
                  label: "Speaking",
                  desc: "Speak the answer (requires Whisper model)",
                },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                onClick={() => setMode(option.id)}
                className={`
                  w-full p-4 rounded-lg border-2 text-left transition-all
                  ${
                    mode === option.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }
                `}
              >
                <p className="font-medium text-slate-800 dark:text-white">
                  {option.label}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {option.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={startSession}
          disabled={isLoading || (stats?.totalPhrases ?? 0) === 0}
          isLoading={isLoading}
          className="w-full py-4 text-lg"
        >
          Start Practice
        </Button>

        {stats?.totalPhrases === 0 && (
          <p className="text-center text-slate-500 dark:text-slate-400 mt-4">
            Add some phrases first to start practicing!
          </p>
        )}
      </div>
    );
  }

  // No more phrases
  if (!currentPhrase && !isLoading) {
    const practicedAny = session.totalPhrases > 0 || seenPhraseIds.length > 0;

    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        {practicedAny ? (
          <>
            <CheckCircleIcon
              size="xl"
              className="mx-auto text-green-500 mb-4"
            />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
              Session Complete!
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              You practiced {session.totalPhrases} phrases with{" "}
              {session.correctAnswers} correct answers.
            </p>
          </>
        ) : (
          <>
            <CalendarIcon size="xl" className="mx-auto text-blue-500 mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
              All caught up!
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              No phrases are due for review right now. Come back later when your
              SRS intervals expire.
            </p>
          </>
        )}
        <Button onClick={endSession}>Back to Dashboard</Button>
      </div>
    );
  }

  // Active practice
  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Session header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Practiced: {seenPhraseIds.length}
            {settings && settings.sessionPhraseLimit > 0
              ? `/${settings.sessionPhraseLimit}`
              : ""}{" "}
            | Correct: {session.correctAnswers} | New: {newPhraseCount}
            {settings && settings.newPhrasesPerSession > 0
              ? `/${settings.newPhrasesPerSession}`
              : ""}{" "}
            | Learned: {sessionLearnedIds.size}
          </p>
        </div>
        <Button onClick={endSession} variant="ghost">
          End Session
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : currentPhrase ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          {/* Prompt */}
          <div className="text-center mb-8 relative">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Translate to German:
            </p>
            <p className="text-2xl font-medium text-slate-800 dark:text-white">
              {currentPhrase.phrase.prompt}
            </p>
            {/* Exclude button */}
            <button
              onClick={async () => {
                try {
                  await invoke("toggle_excluded", {
                    id: currentPhrase.phrase.id,
                  });
                  // Move to next phrase after excluding
                  const phraseId = currentPhrase.phrase.id;
                  const newSeenIds = [...seenPhraseIds, phraseId];
                  setSeenPhraseIds(newSeenIds);
                  loadNextPhrase(newSeenIds, newPhraseCount);
                } catch (err) {
                  console.error("Failed to exclude phrase:", err);
                }
              }}
              className="absolute right-0 top-0 p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Exclude from learning"
            >
              <ExcludeIcon size="sm" />
            </button>
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`
                text-center py-4 rounded-lg mb-6
                ${
                  feedback === "correct"
                    ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                    : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                }
              `}
            >
              <p className="text-lg font-medium">
                {feedback === "correct" ? "Correct!" : "Not quite..."}
              </p>
              {feedback === "correct" && awaitingProceed && (
                <>
                  <p className="text-lg mt-2">
                    <strong>{currentPhrase.phrase.answer}</strong>
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <button
                      onClick={handlePlayAnswer}
                      disabled={tts.isPlaying || tts.isLoading}
                      className="p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-full transition-colors inline-flex items-center justify-center"
                      title="Listen to pronunciation (P)"
                    >
                      <PlayIcon size="sm" />
                    </button>
                    <Button onClick={handleProceedToNext} variant="success">
                      Continue
                    </Button>
                  </div>
                  <p className="text-sm mt-2 text-green-500 dark:text-green-500">
                    Press{" "}
                    <kbd className="px-1 py-0.5 bg-green-100 dark:bg-green-800 rounded">
                      Space
                    </kbd>{" "}
                    to continue,{" "}
                    <kbd className="px-1 py-0.5 bg-green-100 dark:bg-green-800 rounded">
                      P
                    </kbd>{" "}
                    to play
                  </p>
                </>
              )}
              {feedback === "incorrect" && (
                <>
                  {inputAnswer && (
                    <p className="text-sm mt-1">
                      You said: <strong>"{inputAnswer}"</strong>
                    </p>
                  )}
                  <p className="text-sm mt-1">
                    Correct answer:{" "}
                    <strong>{currentPhrase.phrase.answer}</strong>
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <button
                      onClick={handlePlayAnswer}
                      disabled={tts.isPlaying || tts.isLoading}
                      className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors inline-flex items-center justify-center"
                      title="Listen to pronunciation"
                    >
                      <PlayIcon size="sm" />
                    </button>
                    {mode === "speaking" && (
                      <Button
                        onClick={() => {
                          // Override: treat as correct answer
                          setFeedback("correct");
                          handleManualAnswer(true);
                        }}
                        variant="success"
                        size="sm"
                      >
                        I said it correctly
                      </Button>
                    )}
                    <button
                      onClick={() =>
                        setRefiningPhrase({
                          phrase: currentPhrase.phrase,
                          userAnswer: inputAnswer,
                        })
                      }
                      className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium flex items-center gap-1.5"
                      title="Ask AI if your answer is correct"
                    >
                      <LightbulbIcon size="xs" />
                      Ask AI
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Retry mode message for speaking mode */}
          {inRetryMode && mode === "speaking" && settings && (
            <div className="text-center py-4 mb-6 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
              <p className="text-amber-700 dark:text-amber-400 font-medium">
                Repeat correctly {settings.failureRepetitions - retryCount} more
                time{settings.failureRepetitions - retryCount !== 1 ? "s" : ""}{" "}
                to continue
              </p>
            </div>
          )}

          {/* Try Again button for incorrect answers (not in speaking retry mode) */}
          {feedback === "incorrect" &&
            !(inRetryMode && mode === "speaking") && (
              <Button
                onClick={() => {
                  setShowAnswer(false);
                  setInputAnswer("");
                  setFeedback(null);
                }}
                variant="secondary"
                className="w-full mb-6"
              >
                Try Again
              </Button>
            )}

          {/* Mode-specific UI */}
          {mode === "manual" && (
            <div className="space-y-4">
              {!showAnswer ? (
                <Button
                  onClick={() => setShowAnswer(true)}
                  variant="secondary"
                  className="w-full py-4"
                >
                  Show Answer
                </Button>
              ) : (
                <>
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <p className="text-xl font-medium text-slate-800 dark:text-white">
                      {currentPhrase.phrase.answer}
                    </p>
                    <button
                      onClick={handlePlayAnswer}
                      disabled={tts.isPlaying || tts.isLoading}
                      className="mt-2 p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                    >
                      <PlayIcon size="sm" />
                    </button>
                  </div>
                  {!feedback && (
                    <div className="flex gap-4">
                      <Button
                        onClick={() => handleManualAnswer(false)}
                        variant="danger"
                        className="flex-1 py-4"
                      >
                        Incorrect
                      </Button>
                      <Button
                        onClick={() => handleManualAnswer(true)}
                        variant="success"
                        className="flex-1 py-4"
                      >
                        Correct
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {mode === "typing" && !feedback && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCheckAnswer();
              }}
              className="space-y-4"
            >
              <input
                type="text"
                value={inputAnswer}
                onChange={(e) => setInputAnswer(e.target.value)}
                placeholder="Type your answer in German..."
                autoFocus
                className="w-full px-4 py-4 text-lg border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-center"
              />
              <Button
                type="submit"
                disabled={!inputAnswer.trim()}
                className="w-full py-4"
              >
                Check Answer
              </Button>
            </form>
          )}

          {mode === "speaking" && (!feedback || inRetryMode) && (
            <div className="text-center space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {inRetryMode
                  ? "Speak the correct answer"
                  : "Press and hold to record your answer"}
              </p>
              <div className="flex justify-center">
                <VoiceButton
                  status={voiceRecording.status}
                  isAvailable={voiceRecording.isAvailable}
                  onPress={voiceRecording.startRecording}
                  onRelease={voiceRecording.stopRecording}
                  size="lg"
                />
              </div>
              {inputAnswer && !inRetryMode && (
                <p className="text-slate-600 dark:text-slate-300">
                  Heard: "{inputAnswer}"
                </p>
              )}
              {!voiceRecording.isAvailable && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Voice recording not available. Download a Whisper model in
                  Settings.
                </p>
              )}
              {/* Show Answer button - reveals answer but counts as incorrect and enters retry mode */}
              {!inRetryMode && !showAnswer && (
                <button
                  onClick={async () => {
                    if (!currentPhrase || !settings) return;
                    const phraseId = currentPhrase.phrase.id;

                    // Reset session streak for this phrase
                    setSessionStreaks((prev) => ({ ...prev, [phraseId]: 0 }));
                    setSessionLearnedIds((prev) => {
                      const newSet = new Set(prev);
                      newSet.delete(phraseId);
                      return newSet;
                    });

                    // Record as incorrect answer for SRS
                    await invoke("record_answer", {
                      phraseId,
                      isCorrect: false,
                    });

                    if (session) {
                      await invoke("update_practice_session", {
                        sessionId: session.id,
                        totalPhrases: seenPhraseIds.length + 1,
                        correctAnswers: session.correctAnswers || 0,
                      });
                      setSession((prev) =>
                        prev
                          ? {
                              ...prev,
                              totalPhrases: seenPhraseIds.length + 1,
                            }
                          : null,
                      );
                    }

                    // Enter retry mode - force repetition like a wrong answer
                    setShowAnswer(true);
                    setFeedback("incorrect");
                    setInRetryMode(true);
                    setRetryCount(0);
                    setRequiresRetry(true);
                  }}
                  className="mt-4 px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm"
                >
                  Show Answer (skip)
                </button>
              )}
            </div>
          )}

          {/* Speaking mode: after showing answer via skip, show Next button */}
          {mode === "speaking" &&
            showAnswer &&
            feedback === "incorrect" &&
            !inRetryMode && (
              <div className="text-center space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xl font-medium text-slate-800 dark:text-white">
                    {currentPhrase.phrase.answer}
                  </p>
                  <button
                    onClick={handlePlayAnswer}
                    disabled={tts.isPlaying || tts.isLoading}
                    className="mt-2 p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                  >
                    <PlayIcon size="sm" />
                  </button>
                </div>
                <Button
                  onClick={() => {
                    const phraseId = currentPhrase.phrase.id;
                    const newSeenIds = [...seenPhraseIds, phraseId];
                    setSeenPhraseIds(newSeenIds);
                    setShowAnswer(false);
                    loadNextPhrase(newSeenIds, newPhraseCount);
                  }}
                  className="w-full"
                >
                  Next
                </Button>
              </div>
            )}

          {requiresRetry && !feedback && !inRetryMode && (
            <p className="text-center text-sm text-amber-600 dark:text-amber-400 mt-4">
              Retry mode: answer correctly to continue
            </p>
          )}
        </div>
      ) : null}

      {/* Phrase Refinement Dialog */}
      {refiningPhrase && (
        <PhraseRefinementDialog
          phrase={refiningPhrase.phrase}
          onClose={() => {
            setRefiningPhrase(null);
            // Clear feedback and allow retry
            setFeedback(null);
            setInputAnswer("");
          }}
          onAccept={async (prompt, answer, accepted) => {
            const request: UpdatePhraseRequest = {
              prompt,
              answer,
              accepted,
            };
            await invoke<Phrase>("update_phrase", {
              id: refiningPhrase.phrase.id,
              request,
            });

            // Update current phrase if it's the same one
            if (
              currentPhrase &&
              currentPhrase.phrase.id === refiningPhrase.phrase.id
            ) {
              setCurrentPhrase({
                ...currentPhrase,
                phrase: { ...currentPhrase.phrase, prompt, answer, accepted },
              });
            }
          }}
          onAudioRegenerated={(audioPath) => {
            if (
              currentPhrase &&
              currentPhrase.phrase.id === refiningPhrase.phrase.id
            ) {
              setCurrentPhrase({
                ...currentPhrase,
                phrase: { ...currentPhrase.phrase, audioPath },
              });
            }
          }}
        />
      )}
    </div>
  );
}
