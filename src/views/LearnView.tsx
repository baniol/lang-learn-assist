import { useState, useEffect, useCallback } from "react";
import { PhraseRefinementDialog } from "../components/PhraseRefinementDialog";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useTTS } from "../hooks/useTTS";
import { usePracticeSession } from "../hooks/usePracticeSession";
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
import {
  getLearningStats,
  validateAnswer,
  toggleExcluded,
  updatePhrase,
  updatePhraseAudio,
} from "../api";
import type { LearningStats, ExerciseMode, Phrase } from "../types";

export function LearnView() {
  const { settings, refreshSettings } = useSettings();
  const [mode, setMode] = useState<ExerciseMode>("manual");
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [inputAnswer, setInputAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(
    null
  );
  const [awaitingProceed, setAwaitingProceed] = useState(false);
  const [refiningPhrase, setRefiningPhrase] = useState<{
    phrase: Phrase;
    userAnswer: string;
  } | null>(null);

  const practiceSession = usePracticeSession({
    settings,
    onSettingsRefresh: refreshSettings,
  });

  const handleAudioGenerated = useCallback(
    async (phraseId: number, audioPath: string) => {
      try {
        await updatePhraseAudio(phraseId, audioPath);
        if (practiceSession.currentPhrase?.phrase.id === phraseId) {
          practiceSession.setCurrentPhrase({
            ...practiceSession.currentPhrase,
            phrase: { ...practiceSession.currentPhrase.phrase, audioPath },
          });
        }
      } catch (err) {
        console.error("Failed to save audio path:", err);
      }
    },
    [practiceSession]
  );

  const tts = useTTS({
    enabled: true,
    onError: (err) => console.error("TTS error:", err),
    onAudioGenerated: handleAudioGenerated,
  });

  const voiceLanguage =
    practiceSession.currentPhrase?.phrase.targetLanguage ||
    settings?.targetLanguage ||
    "de";

  const voiceRecording = useVoiceRecording({
    enabled: mode === "speaking",
    language: voiceLanguage,
    prompt: practiceSession.currentPhrase?.phrase.answer,
    onTranscription: (text) => {
      setInputAnswer(text);
      handleCheckAnswer(text);
    },
    onError: (err) => console.error("Voice error:", err),
    disableSpaceKey: awaitingProceed,
  });

  useEffect(() => {
    if (settings) {
      setMode(settings.defaultExerciseMode);
      loadStats(settings.targetLanguage);
    }
  }, [settings]);

  // Reset UI state when phrase changes
  useEffect(() => {
    setShowAnswer(false);
    setInputAnswer("");
    setFeedback(null);
    setAwaitingProceed(false);
  }, [practiceSession.currentPhrase?.phrase.id]);

  const loadStats = async (targetLanguage?: string) => {
    try {
      const data = await getLearningStats(
        targetLanguage || settings?.targetLanguage
      );
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const handleCheckAnswer = useCallback(
    async (answer?: string) => {
      if (!practiceSession.currentPhrase || !settings) return;

      const answerToCheck = answer || inputAnswer;
      if (!answerToCheck.trim()) return;

      const phraseId = practiceSession.currentPhrase.phrase.id;

      try {
        const isCorrect = await validateAnswer(phraseId, answerToCheck);

        setFeedback(isCorrect ? "correct" : "incorrect");

        if (isCorrect) {
          if (practiceSession.inRetryMode && mode === "speaking") {
            const newRetryCount = practiceSession.retryCount + 1;
            practiceSession.setRetryCount(newRetryCount);

            if (newRetryCount >= settings.failureRepetitions) {
              practiceSession.setInRetryMode(false);
              practiceSession.setRetryCount(0);
              practiceSession.setRequiresRetry(false);
              setAwaitingProceed(true);
            } else {
              setTimeout(() => {
                setFeedback(null);
                setInputAnswer("");
              }, 1500);
            }
          } else {
            // Record answer - backend handles session streak tracking
            await practiceSession.recordAnswer(phraseId, true);
            practiceSession.setRequiresRetry(false);
            setAwaitingProceed(true);
          }
        } else {
          // Record incorrect answer - backend handles session streak reset
          await practiceSession.recordAnswer(phraseId, false);

          if (mode === "speaking") {
            practiceSession.setInRetryMode(true);
            practiceSession.setRetryCount(0);
          }
          practiceSession.setRequiresRetry(true);
        }
      } catch (err) {
        console.error("Failed to check answer:", err);
      }
    },
    [practiceSession, inputAnswer, settings, mode]
  );

  const handleManualAnswer = async (isCorrect: boolean) => {
    if (!practiceSession.currentPhrase || !settings) return;

    const phraseId = practiceSession.currentPhrase.phrase.id;
    setFeedback(isCorrect ? "correct" : "incorrect");

    try {
      // Record answer - backend handles all streak tracking
      await practiceSession.recordAnswer(phraseId, isCorrect);
      setAwaitingProceed(true);
    } catch (err) {
      console.error("Failed to record answer:", err);
    }
  };

  const handlePlayAnswer = useCallback(() => {
    if (!practiceSession.currentPhrase) return;
    tts.speak(
      practiceSession.currentPhrase.phrase.answer,
      practiceSession.currentPhrase.phrase.id,
      practiceSession.currentPhrase.phrase.audioPath || undefined,
      practiceSession.currentPhrase.phrase.targetLanguage
    );
  }, [practiceSession.currentPhrase, tts]);

  const handleProceedToNext = useCallback(() => {
    if (!practiceSession.currentPhrase || !awaitingProceed) return;
    practiceSession.markPhraseSeen(practiceSession.currentPhrase.phrase.id);
    setAwaitingProceed(false);
    practiceSession.loadNextPhrase();
  }, [practiceSession, awaitingProceed]);

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

  const handleEndSession = async () => {
    await practiceSession.endSession();
    loadStats(settings?.targetLanguage);
  };

  const handleExcludePhrase = async () => {
    if (!practiceSession.currentPhrase) return;
    try {
      await toggleExcluded(practiceSession.currentPhrase.phrase.id);
      practiceSession.markPhraseSeen(practiceSession.currentPhrase.phrase.id);
      practiceSession.loadNextPhrase();
    } catch (err) {
      console.error("Failed to exclude phrase:", err);
    }
  };

  const handleShowAnswerSkip = async () => {
    if (!practiceSession.currentPhrase || !settings) return;
    const phraseId = practiceSession.currentPhrase.phrase.id;

    // Record as incorrect - backend handles session state
    await practiceSession.recordAnswer(phraseId, false);

    setShowAnswer(true);
    setFeedback("incorrect");
    practiceSession.setInRetryMode(true);
    practiceSession.setRetryCount(0);
    practiceSession.setRequiresRetry(true);
  };

  const handleSpeakingNext = () => {
    if (!practiceSession.currentPhrase) return;
    practiceSession.markPhraseSeen(practiceSession.currentPhrase.phrase.id);
    setShowAnswer(false);
    practiceSession.loadNextPhrase();
  };

  const handleStartSession = async () => {
    await practiceSession.startSession(mode);
  };

  // Not in a session - show stats and start options
  if (!practiceSession.session) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
          Learn
        </h1>

        {stats && <SessionStats stats={stats} />}

        <ModeSelector mode={mode} onModeChange={setMode} />

        <Button
          onClick={handleStartSession}
          disabled={
            practiceSession.isLoading || (stats?.totalPhrases ?? 0) === 0
          }
          isLoading={practiceSession.isLoading}
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
  if (!practiceSession.currentPhrase && !practiceSession.isLoading) {
    const practicedAny =
      practiceSession.session.totalPhrases > 0 ||
      practiceSession.seenPhraseIds.length > 0;

    return (
      <SessionComplete
        totalPhrases={practiceSession.session.totalPhrases}
        correctAnswers={practiceSession.session.correctAnswers || 0}
        practicedAny={practicedAny}
        onEndSession={handleEndSession}
      />
    );
  }

  const currentPhrase = practiceSession.currentPhrase;

  // Active practice
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <SessionHeader
        seenCount={practiceSession.seenPhraseIds.length}
        totalLimit={settings?.sessionPhraseLimit ?? 0}
        correctCount={practiceSession.session.correctAnswers || 0}
        newCount={practiceSession.newPhraseCount}
        newLimit={settings?.newPhrasesPerSession ?? 0}
        learnedCount={practiceSession.sessionLearnedCount}
        onEndSession={handleEndSession}
      />

      {practiceSession.isLoading ? (
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

          {practiceSession.inRetryMode && mode === "speaking" && settings && (
            <RetryModeMessage
              remainingRetries={
                settings.failureRepetitions - practiceSession.retryCount
              }
            />
          )}

          {feedback === "incorrect" &&
            !(practiceSession.inRetryMode && mode === "speaking") && (
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

          {mode === "speaking" && (!feedback || practiceSession.inRetryMode) && (
            <SpeakingExercise
              inputAnswer={inputAnswer}
              answer={currentPhrase.phrase.answer}
              showAnswer={showAnswer}
              inRetryMode={practiceSession.inRetryMode}
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
            !practiceSession.inRetryMode && (
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

          {practiceSession.requiresRetry &&
            !feedback &&
            !practiceSession.inRetryMode && (
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
            await updatePhrase(refiningPhrase.phrase.id, {
              prompt,
              answer,
              accepted,
            });

            if (
              currentPhrase &&
              currentPhrase.phrase.id === refiningPhrase.phrase.id
            ) {
              practiceSession.setCurrentPhrase({
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
              practiceSession.setCurrentPhrase({
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
