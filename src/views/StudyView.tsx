import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getDeck } from "../lib/decks";
import { validateAnswer, updatePhraseAudio, updatePhrase, getLearningStats } from "../api";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useTTS } from "../hooks/useTTS";
import { useStudySession } from "../hooks/useStudySession";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { Button, Spinner } from "../components/ui";
import { EmptyState } from "../components/shared";
import { PhraseRefinementDialog } from "../components/PhraseRefinementDialog";
import { BookIcon } from "../components/icons";
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
import { DeckStudyHeader } from "../components/decks";
import type { ViewType, ExerciseMode, Deck, Phrase, LearningStats, StudyModeType } from "../types";

interface StudyViewProps {
  // Either deckId (for deck learning) or nothing (for SRS review)
  deckId?: number;
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function StudyView({ deckId, onNavigate }: StudyViewProps) {
  const { settings, refreshSettings } = useSettings();
  const toast = useToast();

  // Determine study mode - memoize to prevent infinite re-renders
  const studyMode: StudyModeType = useMemo(
    () => (deckId ? { type: "deck_learning", deckId } : { type: "srs_review" }),
    [deckId]
  );
  const isDeckMode = studyMode.type === "deck_learning";

  const [deck, setDeck] = useState<Deck | null>(null);
  const [deckLoading, setDeckLoading] = useState(isDeckMode);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [mode, setMode] = useState<ExerciseMode>("manual");
  const [showAnswer, setShowAnswer] = useState(false);
  const [inputAnswer, setInputAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [awaitingProceed, setAwaitingProceed] = useState(false);
  const [refiningPhrase, setRefiningPhrase] = useState<{
    phrase: Phrase;
    userAnswer: string;
  } | null>(null);

  const studySession = useStudySession({
    mode: studyMode,
    settings,
    onSettingsRefresh: refreshSettings,
  });

  // Ref to track current phrase for use in callbacks
  const currentPhraseRef = useRef(studySession.currentPhrase);
  currentPhraseRef.current = studySession.currentPhrase;

  // Load deck info (for deck mode)
  useEffect(() => {
    if (!isDeckMode || !deckId) {
      setDeckLoading(false);
      return;
    }

    const loadDeck = async () => {
      try {
        const deckData = await getDeck(deckId);
        setDeck(deckData);
      } catch (err) {
        console.error("Failed to load deck:", err);
        toast.error("Failed to load deck");
      } finally {
        setDeckLoading(false);
      }
    };
    loadDeck();
  }, [isDeckMode, deckId, toast]);

  // Load stats (for SRS mode)
  useEffect(() => {
    if (isDeckMode) return;
    loadStats(settings?.targetLanguage);
  }, [isDeckMode, settings?.targetLanguage]);

  const loadStats = async (targetLanguage?: string) => {
    try {
      const data = await getLearningStats(targetLanguage || settings?.targetLanguage);
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
      toast.error("Failed to load learning stats");
    }
  };

  useEffect(() => {
    if (settings) {
      setMode(settings.defaultExerciseMode);
    }
  }, [settings]);

  // Reset UI state when phrase changes
  useEffect(() => {
    setShowAnswer(false);
    setInputAnswer("");
    setFeedback(null);
    setAwaitingProceed(false);
  }, [studySession.currentPhrase?.phrase.id]);

  const handleAudioGenerated = useCallback(
    async (phraseId: number, audioPath: string) => {
      try {
        await updatePhraseAudio(phraseId, audioPath);
        const currentPhrase = currentPhraseRef.current;
        if (currentPhrase?.phrase.id === phraseId) {
          studySession.setCurrentPhrase({
            ...currentPhrase,
            phrase: { ...currentPhrase.phrase, audioPath },
          });
        }
      } catch (err) {
        console.error("Failed to save audio path:", err);
      }
    },
    [studySession]
  );

  const tts = useTTS({
    enabled: true,
    onError: (err) => console.error("TTS error:", err),
    onAudioGenerated: handleAudioGenerated,
  });

  const voiceLanguage =
    studySession.currentPhrase?.phrase.targetLanguage ||
    settings?.targetLanguage ||
    "de";

  const voiceRecording = useVoiceRecording({
    enabled: mode === "speaking",
    language: voiceLanguage,
    prompt: studySession.currentPhrase?.phrase.answer,
    onTranscription: (text) => {
      setInputAnswer(text);
      handleCheckAnswer(text);
    },
    onError: (err) => console.error("Voice error:", err),
    disableSpaceKey: awaitingProceed,
  });

  const handleCheckAnswer = useCallback(
    async (answer?: string) => {
      if (!studySession.currentPhrase || !settings) return;

      const answerToCheck = answer || inputAnswer;
      if (!answerToCheck.trim()) return;

      const phraseId = studySession.currentPhrase.phrase.id;

      try {
        const isCorrect = await validateAnswer(phraseId, answerToCheck);

        setFeedback(isCorrect ? "correct" : "incorrect");

        if (isCorrect) {
          if (studySession.inRetryMode && mode === "speaking") {
            const newRetryCount = studySession.retryCount + 1;
            studySession.setRetryCount(newRetryCount);

            if (newRetryCount >= (settings.failureRepetitions || 3)) {
              studySession.setInRetryMode(false);
              studySession.setRetryCount(0);
              studySession.setRequiresRetry(false);
              setAwaitingProceed(true);
            } else {
              setTimeout(() => {
                setFeedback(null);
                setInputAnswer("");
              }, 1500);
            }
          } else {
            try {
              await studySession.recordAnswer(phraseId, true);
            } catch (recordErr) {
              console.error("Failed to record correct answer:", recordErr);
            }
            studySession.setRequiresRetry(false);
            setAwaitingProceed(true);
          }
        } else {
          try {
            await studySession.recordAnswer(phraseId, false);
          } catch (recordErr) {
            console.error("Failed to record incorrect answer:", recordErr);
          }

          if (mode === "speaking") {
            studySession.setInRetryMode(true);
            studySession.setRetryCount(0);
          }
          studySession.setRequiresRetry(true);
        }
      } catch (err) {
        console.error("Failed to check answer:", err);
        toast.error("Failed to check answer");
      }
    },
    [studySession, inputAnswer, settings, mode, toast]
  );

  const handleManualAnswer = async (isCorrect: boolean) => {
    if (!studySession.currentPhrase) return;

    const phraseId = studySession.currentPhrase.phrase.id;
    setFeedback(isCorrect ? "correct" : "incorrect");

    try {
      await studySession.recordAnswer(phraseId, isCorrect);
    } catch (err) {
      console.error("Failed to record answer:", err);
    }
    setAwaitingProceed(true);
  };

  const handlePlayAnswer = useCallback(() => {
    if (!studySession.currentPhrase) return;
    tts.speak(
      studySession.currentPhrase.phrase.answer,
      studySession.currentPhrase.phrase.id,
      studySession.currentPhrase.phrase.audioPath || undefined,
      studySession.currentPhrase.phrase.targetLanguage
    );
  }, [studySession.currentPhrase, tts]);

  const handleProceedToNext = useCallback(() => {
    if (!studySession.currentPhrase || !awaitingProceed) return;

    // For SRS mode: only exclude graduated phrases
    // For deck mode: mark as seen but phrases can come back
    const lastResult = studySession.lastAnswerResult;
    const shouldExclude = isDeckMode
      ? true // Always mark seen in deck mode
      : lastResult && lastResult.progress.intervalDays >= 1; // Only exclude graduated in SRS

    if (shouldExclude) {
      studySession.markPhraseSeen(studySession.currentPhrase.phrase.id);
    }

    setAwaitingProceed(false);
    setFeedback(null);
    setInputAnswer("");
    setShowAnswer(false);
    studySession.clearLastAnswer();
    studySession.loadNextPhrase();
  }, [studySession, awaitingProceed, isDeckMode]);

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
    await studySession.endSession();
    if (isDeckMode && deckId) {
      onNavigate("deck-detail", { deckId });
    } else {
      loadStats(settings?.targetLanguage);
    }
  };

  const handleBack = () => {
    if (isDeckMode && deckId) {
      onNavigate("deck-detail", { deckId });
    } else {
      onNavigate("learn");
    }
  };

  const handleShowAnswerSkip = async () => {
    if (!studySession.currentPhrase) return;
    const phraseId = studySession.currentPhrase.phrase.id;

    await studySession.recordAnswer(phraseId, false);

    setShowAnswer(true);
    setFeedback("incorrect");
    studySession.setInRetryMode(true);
    studySession.setRetryCount(0);
    studySession.setRequiresRetry(true);
  };

  const handleSpeakingNext = () => {
    if (!studySession.currentPhrase) return;
    studySession.markPhraseSeen(studySession.currentPhrase.phrase.id);
    setShowAnswer(false);
    setFeedback(null);
    setInputAnswer("");
    setAwaitingProceed(false);
    studySession.loadNextPhrase();
  };

  const handleStartSession = async () => {
    await studySession.startSession(mode);
  };

  // Loading state
  if (deckLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  // Deck not found (deck mode only)
  if (isDeckMode && !deck) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500 dark:text-slate-400">Deck not found</div>
      </div>
    );
  }

  // Not in a session - show start options
  if (!studySession.session) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        {isDeckMode ? (
          <>
            <div className="flex items-center gap-2 mb-6">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                Back
              </Button>
            </div>

            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
              Study: {deck?.name}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              {deck?.graduationThreshold} correct answers to graduate a phrase to SRS
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
              SRS Review
            </h1>
            {stats && <SessionStats stats={stats} />}
          </>
        )}

        <ModeSelector mode={mode} onModeChange={setMode} />

        <Button
          onClick={handleStartSession}
          disabled={studySession.isLoading || (!isDeckMode && (stats?.totalPhrases ?? 0) === 0)}
          isLoading={studySession.isLoading}
          className="w-full py-4 text-lg"
        >
          {isDeckMode ? "Start Studying" : "Start Practice"}
        </Button>

        {!isDeckMode && stats?.totalPhrases === 0 && (
          <p className="text-center text-slate-500 dark:text-slate-400 mt-4">
            Add some phrases first to start practicing!
          </p>
        )}
      </div>
    );
  }

  // No more phrases
  if (!studySession.currentPhrase && !studySession.isLoading) {
    const practicedAny =
      studySession.session.totalPhrases > 0 || studySession.seenPhraseIds.length > 0;

    if (isDeckMode) {
      return (
        <div className="p-6 max-w-2xl mx-auto">
          <EmptyState
            icon={
              <BookIcon size="xl" className="text-slate-300 dark:text-slate-600" />
            }
            title="Session Complete"
            description={
              practicedAny
                ? `Great work! You practiced ${studySession.seenPhraseIds.length} phrases and graduated ${studySession.graduatedCount}.`
                : "No phrases to study right now. Add more phrases to this deck."
            }
            action={{
              label: "Back to Deck",
              onClick: handleEndSession,
            }}
          />
        </div>
      );
    }

    return (
      <SessionComplete
        totalPhrases={studySession.session.totalPhrases}
        correctAnswers={studySession.session.correctAnswers || 0}
        practicedAny={practicedAny}
        onEndSession={handleEndSession}
      />
    );
  }

  const currentPhrase = studySession.currentPhrase;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {isDeckMode && deck ? (
        <DeckStudyHeader
          deckName={deck.name}
          seenCount={studySession.seenPhraseIds.length}
          correctCount={studySession.session.correctAnswers || 0}
          graduatedCount={studySession.graduatedCount}
          graduationThreshold={deck.graduationThreshold}
          onEndSession={handleEndSession}
          onBack={handleBack}
        />
      ) : (
        <SessionHeader
          seenCount={studySession.seenPhraseIds.length}
          totalLimit={settings?.sessionPhraseLimit ?? 0}
          correctCount={studySession.session.correctAnswers || 0}
          newCount={studySession.newPhraseCount}
          newLimit={settings?.newPhrasesPerSession ?? 0}
          learnedCount={studySession.sessionLearnedCount}
          onEndSession={handleEndSession}
        />
      )}

      {studySession.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : currentPhrase ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          {/* Progress indicator for deck mode */}
          {isDeckMode && deck && (
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Progress: {currentPhrase.progress?.deckCorrectCount ?? 0}/{deck.graduationThreshold}
              </span>
              <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, ((currentPhrase.progress?.deckCorrectCount ?? 0) / deck.graduationThreshold) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <ExercisePrompt
            prompt={currentPhrase.phrase.prompt}
            onExclude={() => {
              studySession.markPhraseSeen(currentPhrase.phrase.id);
              studySession.loadNextPhrase();
            }}
          />

          {feedback && (
            <FeedbackDisplay
              type={feedback}
              correctAnswer={currentPhrase.phrase.answer}
              userAnswer={inputAnswer || undefined}
              onPlayAudio={handlePlayAnswer}
              onProceed={handleProceedToNext}
              isPlaying={tts.isPlaying}
              isLoading={tts.isLoading}
              showProceed={awaitingProceed}
              showOverride={mode === "speaking"}
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
            />
          )}

          {studySession.inRetryMode && mode === "speaking" && settings && (
            <RetryModeMessage
              remainingRetries={(settings.failureRepetitions || 3) - studySession.retryCount}
            />
          )}

          {feedback === "incorrect" &&
            !(studySession.inRetryMode && mode === "speaking") && (
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
          )}

          {mode === "typing" && !feedback && (
            <TypingExercise
              inputAnswer={inputAnswer}
              onInputChange={setInputAnswer}
              onSubmit={() => handleCheckAnswer()}
            />
          )}

          {mode === "speaking" && (!feedback || studySession.inRetryMode) && (
            <SpeakingExercise
              inputAnswer={inputAnswer}
              answer={currentPhrase.phrase.answer}
              showAnswer={showAnswer}
              inRetryMode={studySession.inRetryMode}
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
            !studySession.inRetryMode && (
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

          {studySession.requiresRetry && !feedback && !studySession.inRetryMode && (
            <p className="text-center text-sm text-amber-600 dark:text-amber-400 mt-4">
              Retry mode: answer correctly to continue
            </p>
          )}
        </div>
      ) : null}

      {/* Phrase refinement dialog */}
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
              refined: true,
            });

            if (
              studySession.currentPhrase &&
              studySession.currentPhrase.phrase.id === refiningPhrase.phrase.id
            ) {
              studySession.setCurrentPhrase({
                ...studySession.currentPhrase,
                phrase: { ...studySession.currentPhrase.phrase, prompt, answer, accepted, refined: true },
              });
            }
          }}
          onAudioRegenerated={(audioPath) => {
            if (
              studySession.currentPhrase &&
              studySession.currentPhrase.phrase.id === refiningPhrase.phrase.id
            ) {
              studySession.setCurrentPhrase({
                ...studySession.currentPhrase,
                phrase: { ...studySession.currentPhrase.phrase, audioPath },
              });
            }
            setRefiningPhrase((prev) =>
              prev ? { ...prev, phrase: { ...prev.phrase, audioPath } } : null
            );
          }}
        />
      )}
    </div>
  );
}
