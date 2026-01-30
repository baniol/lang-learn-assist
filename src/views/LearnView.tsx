import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VoiceButton } from "../components/VoiceButton";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useTTS } from "../hooks/useTTS";
import type { PhraseWithProgress, LearningStats, ExerciseMode, PracticeSession } from "../types";

export function LearnView() {
  const [mode, setMode] = useState<ExerciseMode>("manual");
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState<PhraseWithProgress | null>(null);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [inputAnswer, setInputAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [seenPhraseIds, setSeenPhraseIds] = useState<number[]>([]);
  const [requiresRetry, setRequiresRetry] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const tts = useTTS({
    enabled: true,
    onError: (err) => console.error("TTS error:", err),
  });

  const voiceRecording = useVoiceRecording({
    enabled: mode === "speaking",
    language: "de",
    onTranscription: (text) => {
      setInputAnswer(text);
      handleCheckAnswer(text);
    },
    onError: (err) => console.error("Voice error:", err),
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await invoke<LearningStats>("get_learning_stats", {});
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const startSession = async () => {
    setIsLoading(true);
    try {
      const newSession = await invoke<PracticeSession>("start_practice_session", {
        exerciseMode: mode,
      });
      setSession(newSession);
      setSeenPhraseIds([]);
      await loadNextPhrase([]);
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadNextPhrase = async (excludeIds: number[]) => {
    setIsLoading(true);
    setShowAnswer(false);
    setInputAnswer("");
    setFeedback(null);

    try {
      const phrase = await invoke<PhraseWithProgress | null>("get_next_phrase", {
        excludeIds: excludeIds.length > 0 ? excludeIds : null,
      });
      setCurrentPhrase(phrase);

      if (!phrase) {
        // No more phrases
        if (session) {
          await invoke("finish_practice_session", { sessionId: session.id });
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
      if (!currentPhrase) return;

      const answerToCheck = answer || inputAnswer;
      if (!answerToCheck.trim()) return;

      try {
        const isCorrect = await invoke<boolean>("validate_answer", {
          phraseId: currentPhrase.phrase.id,
          input: answerToCheck,
        });

        setFeedback(isCorrect ? "correct" : "incorrect");

        await invoke("record_answer", {
          phraseId: currentPhrase.phrase.id,
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
                  correctAnswers: (prev.correctAnswers || 0) + (isCorrect ? 1 : 0),
                }
              : null
          );
        }

        if (!isCorrect) {
          setRequiresRetry(true);
          setRetryCount(0);
        } else if (requiresRetry) {
          // In retry mode, need 2 correct in a row
          if (retryCount + 1 >= 2) {
            setRequiresRetry(false);
            setRetryCount(0);
          } else {
            setRetryCount((prev) => prev + 1);
          }
        }

        // Auto-advance only on correct answers
        if (isCorrect && !requiresRetry) {
          setTimeout(() => {
            const newSeenIds = [...seenPhraseIds, currentPhrase.phrase.id];
            setSeenPhraseIds(newSeenIds);
            loadNextPhrase(newSeenIds);
          }, 1500);
        } else if (isCorrect && requiresRetry && retryCount + 1 >= 2) {
          setTimeout(() => {
            const newSeenIds = [...seenPhraseIds, currentPhrase.phrase.id];
            setSeenPhraseIds(newSeenIds);
            loadNextPhrase(newSeenIds);
          }, 1500);
        }
        // On incorrect: keep feedback visible, user clicks "Try Again"
      } catch (err) {
        console.error("Failed to check answer:", err);
      }
    },
    [currentPhrase, inputAnswer, session, seenPhraseIds, requiresRetry, retryCount]
  );

  const handleManualAnswer = async (isCorrect: boolean) => {
    if (!currentPhrase) return;

    setFeedback(isCorrect ? "correct" : "incorrect");

    try {
      await invoke("record_answer", {
        phraseId: currentPhrase.phrase.id,
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
                correctAnswers: (prev.correctAnswers || 0) + (isCorrect ? 1 : 0),
              }
            : null
        );
      }

      setTimeout(() => {
        const newSeenIds = [...seenPhraseIds, currentPhrase.phrase.id];
        setSeenPhraseIds(newSeenIds);
        loadNextPhrase(newSeenIds);
      }, 1000);
    } catch (err) {
      console.error("Failed to record answer:", err);
    }
  };

  const handlePlayAnswer = () => {
    if (!currentPhrase) return;
    tts.speak(currentPhrase.phrase.answer, currentPhrase.phrase.id, currentPhrase.phrase.audioPath || undefined);
  };

  const endSession = async () => {
    if (session) {
      await invoke("finish_practice_session", { sessionId: session.id });
    }
    setSession(null);
    setCurrentPhrase(null);
    setSeenPhraseIds([]);
    loadStats();
  };

  // Not in a session - show stats and start options
  if (!session) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Learn</h1>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalPhrases}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 p-4 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.learnedCount}</p>
              <p className="text-sm text-green-600 dark:text-green-400">Learned</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800 p-4 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.learningCount}</p>
              <p className="text-sm text-amber-600 dark:text-amber-400">Learning</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-4 text-center">
              <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{stats.newCount}</p>
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
            {([
              { id: "manual", label: "Manual", desc: "Reveal answer and self-grade" },
              { id: "typing", label: "Typing", desc: "Type the answer in German" },
              { id: "speaking", label: "Speaking", desc: "Speak the answer (requires Whisper model)" },
            ] as const).map((option) => (
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
                <p className="font-medium text-slate-800 dark:text-white">{option.label}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{option.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startSession}
          disabled={isLoading || (stats?.totalPhrases ?? 0) === 0}
          className="w-full py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg font-medium"
        >
          {isLoading ? "Loading..." : "Start Practice"}
        </button>

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
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <svg className="w-20 h-20 mx-auto text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
          Session Complete!
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          You practiced {session.totalPhrases} phrases with {session.correctAnswers} correct answers.
        </p>
        <button
          onClick={endSession}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Back to Dashboard
        </button>
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
            Practiced: {seenPhraseIds.length} | Correct: {session.correctAnswers}
          </p>
        </div>
        <button
          onClick={endSession}
          className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          End Session
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : currentPhrase ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          {/* Prompt */}
          <div className="text-center mb-8">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Translate to German:
            </p>
            <p className="text-2xl font-medium text-slate-800 dark:text-white">
              {currentPhrase.phrase.prompt}
            </p>
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
              {feedback === "incorrect" && (
                <>
                  <p className="text-sm mt-1">
                    Correct answer: <strong>{currentPhrase.phrase.answer}</strong>
                  </p>
                  <button
                    onClick={handlePlayAnswer}
                    disabled={tts.isPlaying || tts.isLoading}
                    className="mt-2 p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors inline-flex items-center justify-center"
                    title="Listen to pronunciation"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Try Again button for incorrect answers */}
          {feedback === "incorrect" && (
            <button
              onClick={() => {
                setShowAnswer(false);
                setInputAnswer("");
                setFeedback(null);
              }}
              className="w-full py-3 mb-6 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors font-medium"
            >
              Try Again
            </button>
          )}

          {/* Mode-specific UI */}
          {mode === "manual" && (
            <div className="space-y-4">
              {!showAnswer ? (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Show Answer
                </button>
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
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  </div>
                  {!feedback && (
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleManualAnswer(false)}
                        className="flex-1 py-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium"
                      >
                        Incorrect
                      </button>
                      <button
                        onClick={() => handleManualAnswer(true)}
                        className="flex-1 py-4 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors font-medium"
                      >
                        Correct
                      </button>
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
              <button
                type="submit"
                disabled={!inputAnswer.trim()}
                className="w-full py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Check Answer
              </button>
            </form>
          )}

          {mode === "speaking" && !feedback && (
            <div className="text-center space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Press and hold to record your answer
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
              {inputAnswer && (
                <p className="text-slate-600 dark:text-slate-300">
                  Heard: "{inputAnswer}"
                </p>
              )}
              {!voiceRecording.isAvailable && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Voice recording not available. Download a Whisper model in Settings.
                </p>
              )}
            </div>
          )}

          {requiresRetry && !feedback && (
            <p className="text-center text-sm text-amber-600 dark:text-amber-400 mt-4">
              Retry mode: {2 - retryCount} more correct answers needed
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
