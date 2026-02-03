import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PhraseRefinementDialog } from "../components/PhraseRefinementDialog";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useTTS } from "../hooks/useTTS";
import { useSettings } from "../contexts/SettingsContext";
import { Button, Spinner } from "../components/ui";
import {
  SessionHeader,
  SessionStats,
  SessionComplete,
  ModeSelector,
  FeedbackDisplay,
  ManualExercise,
  TypingExercise,
  SpeakingExercise,
  ExercisePrompt,
  RetryModeMessage,
} from "../components/learning";
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
    null
  );
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [inputAnswer, setInputAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(
    null
  );
  const [seenPhraseIds, setSeenPhraseIds] = useState<number[]>([]);
  const [requiresRetry, setRequiresRetry] = useState(false);

  // Session-based progress per phrase: { phraseId: sessionStreak }
  const [sessionStreaks, setSessionStreaks] = useState<Record<number, number>>(
    {}
  );

  // Phrases learned in this session (reached requiredStreak)
  const [sessionLearnedIds, setSessionLearnedIds] = useState<Set<number>>(
    new Set()
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
        if (currentPhrase?.phrase.id === phraseId) {
          setCurrentPhrase((prev) =>
            prev ? { ...prev, phrase: { ...prev.phrase, audioPath } } : null
          );
        }
      } catch (err) {
        console.error("Failed to save audio path:", err);
      }
    },
    [currentPhrase?.phrase.id]
  );

  const tts = useTTS({
    enabled: true,
    onError: (err) => console.error("TTS error:", err),
    onAudioGenerated: handleAudioGenerated,
  });

  const voiceLanguage =
    currentPhrase?.phrase.targetLanguage || settings?.targetLanguage || "de";

  const voiceRecording = useVoiceRecording({
    enabled: mode === "speaking",
    language: voiceLanguage,
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

  useEffect(() => {
    return () => {
      if (sessionIdRef.current && stateRef.current) {
        invoke("save_session_state", {
          sessionId: sessionIdRef.current,
          state: stateRef.current,
        }).catch((err) =>
          console.error("Failed to save session state on unmount:", err)
        );
      }
    };
  }, []);

  useEffect(() => {
    if (!session) return;
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

  const loadNextPhrase = useCallback(
    async (
      excludeIds: number[],
      currentNewCount: number,
      sessionId?: number
    ) => {
      const activeSessionId = sessionId ?? session?.id;

      if (
        settings &&
        settings.sessionPhraseLimit > 0 &&
        excludeIds.length >= settings.sessionPhraseLimit
      ) {
        setCurrentPhrase(null);
        if (activeSessionId) {
          await invoke("finish_practice_session", {
            sessionId: activeSessionId,
          });
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
          }
        );
        setCurrentPhrase(phrase);

        if (phrase) {
          const isNew = !phrase.progress || phrase.progress.totalAttempts === 0;
          if (isNew) {
            setNewPhraseCount(currentNewCount + 1);
          }
        } else {
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
    },
    [session?.id, settings]
  );

  const restoreSession = useCallback(
    async (activeSession: PracticeSession) => {
      if (!settings) return;

      const state = activeSession.state;
      if (!state) {
        setSession(activeSession);
        setMode(activeSession.exerciseMode as ExerciseMode);
        await loadNextPhrase([], 0, activeSession.id);
        return;
      }

      setSession(activeSession);
      setMode(activeSession.exerciseMode as ExerciseMode);
      setSeenPhraseIds(state.seenPhraseIds);
      setSessionStreaks(state.sessionStreaks);
      setSessionLearnedIds(new Set(state.sessionLearnedIds));
      setNewPhraseCount(state.newPhraseCount);
      setInRetryMode(state.inRetryMode);
      setRetryCount(state.retryCount);
      setRequiresRetry(state.requiresRetry);

      if (state.currentPhraseId) {
        try {
          const phrase = await invoke<PhraseWithProgress | null>(
            "get_next_phrase",
            {
              targetLanguage: settings.targetLanguage || null,
              excludeIds: state.seenPhraseIds.filter(
                (id) => id !== state.currentPhraseId
              ),
              newPhraseCount: state.newPhraseCount,
              newPhraseLimit: settings.newPhrasesPerSession ?? 0,
            }
          );
          setCurrentPhrase(phrase);
        } catch (err) {
          console.error("Failed to restore current phrase:", err);
          await loadNextPhrase(
            state.seenPhraseIds,
            state.newPhraseCount,
            activeSession.id
          );
        }
      } else {
        await loadNextPhrase(
          state.seenPhraseIds,
          state.newPhraseCount,
          activeSession.id
        );
      }
    },
    [settings, loadNextPhrase]
  );

  useEffect(() => {
    if (!settings) return;

    const initialize = async () => {
      try {
        setMode(settings.defaultExerciseMode);
        loadStats(settings.targetLanguage);

        const activeSession = await invoke<PracticeSession | null>(
          "get_active_session",
          { targetLanguage: settings.targetLanguage }
        );

        if (activeSession) {
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
      await refreshSettings();

      const newSession = await invoke<PracticeSession>(
        "start_practice_session",
        { exerciseMode: mode }
      );
      setSession(newSession);
      setSeenPhraseIds([]);
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
            const newRetryCount = retryCount + 1;
            setRetryCount(newRetryCount);

            if (newRetryCount >= settings.failureRepetitions) {
              setInRetryMode(false);
              setRetryCount(0);
              setRequiresRetry(false);
              setAwaitingProceed(true);
            } else {
              setTimeout(() => {
                setFeedback(null);
                setInputAnswer("");
              }, 1500);
            }
          } else {
            const currentStreak = sessionStreaks[phraseId] || 0;
            const newStreak = currentStreak + 1;
            setSessionStreaks((prev) => ({ ...prev, [phraseId]: newStreak }));

            if (newStreak >= settings.requiredStreak) {
              setSessionLearnedIds((prev) => new Set([...prev, phraseId]));
            }

            await invoke("record_answer", { phraseId, isCorrect: true });

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
                  : null
              );
            }

            setRequiresRetry(false);
            setAwaitingProceed(true);
          }
        } else {
          setSessionStreaks((prev) => ({ ...prev, [phraseId]: 0 }));
          setSessionLearnedIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(phraseId);
            return newSet;
          });

          await invoke("record_answer", { phraseId, isCorrect: false });

          if (session) {
            await invoke("update_practice_session", {
              sessionId: session.id,
              totalPhrases: seenPhraseIds.length + 1,
              correctAnswers: session.correctAnswers || 0,
            });
            setSession((prev) =>
              prev
                ? { ...prev, totalPhrases: seenPhraseIds.length + 1 }
                : null
            );
          }

          if (mode === "speaking") {
            setInRetryMode(true);
            setRetryCount(0);
          }
          setRequiresRetry(true);
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
    ]
  );

  const handleManualAnswer = async (isCorrect: boolean) => {
    if (!currentPhrase || !settings) return;

    const phraseId = currentPhrase.phrase.id;
    setFeedback(isCorrect ? "correct" : "incorrect");

    try {
      if (isCorrect) {
        const currentStreak = sessionStreaks[phraseId] || 0;
        const newStreak = currentStreak + 1;
        setSessionStreaks((prev) => ({ ...prev, [phraseId]: newStreak }));

        if (newStreak >= settings.requiredStreak) {
          setSessionLearnedIds((prev) => new Set([...prev, phraseId]));
        }
      } else {
        setSessionStreaks((prev) => ({ ...prev, [phraseId]: 0 }));
        setSessionLearnedIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(phraseId);
          return newSet;
        });
      }

      await invoke("record_answer", { phraseId, isCorrect });

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
            : null
        );
      }

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
      currentPhrase.phrase.targetLanguage
    );
  }, [currentPhrase, tts]);

  const handleProceedToNext = useCallback(() => {
    if (!currentPhrase || !awaitingProceed) return;
    const phraseId = currentPhrase.phrase.id;
    const newSeenIds = [...seenPhraseIds, phraseId];
    setSeenPhraseIds(newSeenIds);
    setAwaitingProceed(false);
    loadNextPhrase(newSeenIds, newPhraseCount);
  }, [
    currentPhrase,
    awaitingProceed,
    seenPhraseIds,
    newPhraseCount,
    loadNextPhrase,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    setSessionStreaks({});
    setSessionLearnedIds(new Set());
    setRetryCount(0);
    setInRetryMode(false);
    setAwaitingProceed(false);
    setNewPhraseCount(0);
    loadStats(targetLang);
  };

  const handleExcludePhrase = async () => {
    if (!currentPhrase) return;
    try {
      await invoke("toggle_excluded", { id: currentPhrase.phrase.id });
      const phraseId = currentPhrase.phrase.id;
      const newSeenIds = [...seenPhraseIds, phraseId];
      setSeenPhraseIds(newSeenIds);
      loadNextPhrase(newSeenIds, newPhraseCount);
    } catch (err) {
      console.error("Failed to exclude phrase:", err);
    }
  };

  const handleShowAnswerSkip = async () => {
    if (!currentPhrase || !settings) return;
    const phraseId = currentPhrase.phrase.id;

    setSessionStreaks((prev) => ({ ...prev, [phraseId]: 0 }));
    setSessionLearnedIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(phraseId);
      return newSet;
    });

    await invoke("record_answer", { phraseId, isCorrect: false });

    if (session) {
      await invoke("update_practice_session", {
        sessionId: session.id,
        totalPhrases: seenPhraseIds.length + 1,
        correctAnswers: session.correctAnswers || 0,
      });
      setSession((prev) =>
        prev ? { ...prev, totalPhrases: seenPhraseIds.length + 1 } : null
      );
    }

    setShowAnswer(true);
    setFeedback("incorrect");
    setInRetryMode(true);
    setRetryCount(0);
    setRequiresRetry(true);
  };

  const handleSpeakingNext = () => {
    if (!currentPhrase) return;
    const phraseId = currentPhrase.phrase.id;
    const newSeenIds = [...seenPhraseIds, phraseId];
    setSeenPhraseIds(newSeenIds);
    setShowAnswer(false);
    loadNextPhrase(newSeenIds, newPhraseCount);
  };

  // Not in a session - show stats and start options
  if (!session) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
          Learn
        </h1>

        {stats && <SessionStats stats={stats} />}

        <ModeSelector mode={mode} onModeChange={setMode} />

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
      <SessionComplete
        totalPhrases={session.totalPhrases}
        correctAnswers={session.correctAnswers || 0}
        practicedAny={practicedAny}
        onEndSession={endSession}
      />
    );
  }

  // Active practice
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <SessionHeader
        seenCount={seenPhraseIds.length}
        totalLimit={settings?.sessionPhraseLimit ?? 0}
        correctCount={session.correctAnswers || 0}
        newCount={newPhraseCount}
        newLimit={settings?.newPhrasesPerSession ?? 0}
        learnedCount={sessionLearnedIds.size}
        onEndSession={endSession}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : currentPhrase ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <ExercisePrompt
            prompt={currentPhrase.phrase.prompt}
            onExclude={handleExcludePhrase}
          />

          {feedback && (
            <FeedbackDisplay
              type={feedback}
              correctAnswer={currentPhrase.phrase.answer}
              userAnswer={inputAnswer || undefined}
              onPlayAudio={handlePlayAnswer}
              onProceed={handleProceedToNext}
              onOverride={() => {
                setFeedback("correct");
                handleManualAnswer(true);
              }}
              onAskAI={() =>
                setRefiningPhrase({
                  phrase: currentPhrase.phrase,
                  userAnswer: inputAnswer,
                })
              }
              isPlaying={tts.isPlaying}
              isLoading={tts.isLoading}
              showProceed={awaitingProceed}
              showOverride={mode === "speaking"}
            />
          )}

          {inRetryMode && mode === "speaking" && settings && (
            <RetryModeMessage
              remainingRetries={settings.failureRepetitions - retryCount}
            />
          )}

          {feedback === "incorrect" && !(inRetryMode && mode === "speaking") && (
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

          {mode === "manual" && (
            <div className="space-y-4">
              <ManualExercise
                answer={currentPhrase.phrase.answer}
                showAnswer={showAnswer}
                hasFeedback={!!feedback}
                isPlaying={tts.isPlaying}
                isLoading={tts.isLoading}
                onShowAnswer={() => setShowAnswer(true)}
                onPlayAudio={handlePlayAnswer}
                onGrade={handleManualAnswer}
              />
            </div>
          )}

          {mode === "typing" && !feedback && (
            <TypingExercise
              inputAnswer={inputAnswer}
              onInputChange={setInputAnswer}
              onSubmit={() => handleCheckAnswer()}
            />
          )}

          {mode === "speaking" && (!feedback || inRetryMode) && (
            <SpeakingExercise
              inputAnswer={inputAnswer}
              answer={currentPhrase.phrase.answer}
              showAnswer={showAnswer}
              inRetryMode={inRetryMode}
              isAvailable={voiceRecording.isAvailable}
              status={voiceRecording.status}
              isPlaying={tts.isPlaying}
              isLoading={tts.isLoading}
              onStartRecording={voiceRecording.startRecording}
              onStopRecording={voiceRecording.stopRecording}
              onShowAnswer={handleShowAnswerSkip}
              onPlayAudio={handlePlayAnswer}
              onNext={handleSpeakingNext}
            />
          )}

          {mode === "speaking" &&
            showAnswer &&
            feedback === "incorrect" &&
            !inRetryMode && (
              <SpeakingExercise
                inputAnswer={inputAnswer}
                answer={currentPhrase.phrase.answer}
                showAnswer={showAnswer}
                inRetryMode={false}
                isAvailable={voiceRecording.isAvailable}
                status={voiceRecording.status}
                isPlaying={tts.isPlaying}
                isLoading={tts.isLoading}
                onStartRecording={voiceRecording.startRecording}
                onStopRecording={voiceRecording.stopRecording}
                onShowAnswer={handleShowAnswerSkip}
                onPlayAudio={handlePlayAnswer}
                onNext={handleSpeakingNext}
              />
            )}

          {requiresRetry && !feedback && !inRetryMode && (
            <p className="text-center text-sm text-amber-600 dark:text-amber-400 mt-4">
              Retry mode: answer correctly to continue
            </p>
          )}
        </div>
      ) : null}

      {refiningPhrase && (
        <PhraseRefinementDialog
          phrase={refiningPhrase.phrase}
          onClose={() => {
            setRefiningPhrase(null);
            setFeedback(null);
            setInputAnswer("");
          }}
          onAccept={async (prompt, answer, accepted) => {
            const request: UpdatePhraseRequest = { prompt, answer, accepted };
            await invoke<Phrase>("update_phrase", {
              id: refiningPhrase.phrase.id,
              request,
            });

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
