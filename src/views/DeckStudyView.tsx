import { useState, useEffect, useCallback, useRef } from "react";
import { getDeck } from "../lib/decks";
import { validateAnswer, updatePhraseAudio, updatePhrase } from "../api";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useTTS } from "../hooks/useTTS";
import { useDeckStudySession } from "../hooks/useDeckStudySession";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { Button, Spinner } from "../components/ui";
import { EmptyState } from "../components/shared";
import { PhraseRefinementDialog } from "../components/PhraseRefinementDialog";
import { BookIcon } from "../components/icons";
import {
  ModeSelector,
  FeedbackDisplay,
  ManualExercise,
  TypingExercise,
  SpeakingExercise,
  ExercisePrompt,
  RetryModeMessage,
} from "../components/learning";
import { DeckStudyHeader } from "../components/decks";
import type { ViewType, ExerciseMode, Deck, Phrase } from "../types";

interface DeckStudyViewProps {
  deckId: number;
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function DeckStudyView({ deckId, onNavigate }: DeckStudyViewProps) {
  const { settings, refreshSettings } = useSettings();
  const toast = useToast();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [deckLoading, setDeckLoading] = useState(true);
  const [mode, setMode] = useState<ExerciseMode>("manual");
  const [showAnswer, setShowAnswer] = useState(false);
  const [inputAnswer, setInputAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [awaitingProceed, setAwaitingProceed] = useState(false);
  const [refiningPhrase, setRefiningPhrase] = useState<{
    phrase: Phrase;
    userAnswer: string;
  } | null>(null);

  const deckStudy = useDeckStudySession({
    deckId,
    settings,
    onSettingsRefresh: refreshSettings,
  });

  // Ref to track current phrase for use in callbacks
  const currentPhraseRef = useRef(deckStudy.currentPhrase);
  currentPhraseRef.current = deckStudy.currentPhrase;

  // Load deck info
  useEffect(() => {
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
  }, [deckId, toast]);

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
      }, [deckStudy.currentPhrase?.phrase.id]);

  const handleAudioGenerated = useCallback(
    async (phraseId: number, audioPath: string) => {
      try {
        await updatePhraseAudio(phraseId, audioPath);
        const currentPhrase = currentPhraseRef.current;
        if (currentPhrase?.phrase.id === phraseId) {
          deckStudy.setCurrentPhrase({
            ...currentPhrase,
            phrase: { ...currentPhrase.phrase, audioPath },
          });
        }
      } catch (err) {
        console.error("Failed to save audio path:", err);
      }
    },
    [deckStudy]
  );

  const tts = useTTS({
    enabled: true,
    onError: (err) => console.error("TTS error:", err),
    onAudioGenerated: handleAudioGenerated,
  });

  const voiceLanguage =
    deckStudy.currentPhrase?.phrase.targetLanguage ||
    settings?.targetLanguage ||
    "de";

  const voiceRecording = useVoiceRecording({
    enabled: mode === "speaking",
    language: voiceLanguage,
    prompt: deckStudy.currentPhrase?.phrase.answer,
    onTranscription: (text) => {
      setInputAnswer(text);
      handleCheckAnswer(text);
    },
    onError: (err) => console.error("Voice error:", err),
    disableSpaceKey: awaitingProceed,
  });

  const handleCheckAnswer = useCallback(
    async (answer?: string) => {
      if (!deckStudy.currentPhrase || !settings) return;

      const answerToCheck = answer || inputAnswer;
      if (!answerToCheck.trim()) return;

      const phraseId = deckStudy.currentPhrase.phrase.id;

      try {
        const isCorrect = await validateAnswer(phraseId, answerToCheck);

        setFeedback(isCorrect ? "correct" : "incorrect");

        if (isCorrect) {
          if (deckStudy.inRetryMode && mode === "speaking") {
            const newRetryCount = deckStudy.retryCount + 1;
            deckStudy.setRetryCount(newRetryCount);

            if (newRetryCount >= (settings.failureRepetitions || 3)) {
              deckStudy.setInRetryMode(false);
              deckStudy.setRetryCount(0);
              deckStudy.setRequiresRetry(false);
              setAwaitingProceed(true);
            } else {
              setTimeout(() => {
                setFeedback(null);
                setInputAnswer("");
              }, 1500);
            }
          } else {
            try {
              await deckStudy.recordAnswer(phraseId, true);
            } catch (recordErr) {
              console.error("Failed to record correct answer:", recordErr);
            }
            deckStudy.setRequiresRetry(false);
            setAwaitingProceed(true);
          }
        } else {
          try {
            await deckStudy.recordAnswer(phraseId, false);
          } catch (recordErr) {
            console.error("Failed to record incorrect answer:", recordErr);
          }

          if (mode === "speaking") {
            deckStudy.setInRetryMode(true);
            deckStudy.setRetryCount(0);
          }
          deckStudy.setRequiresRetry(true);
        }
      } catch (err) {
        console.error("Failed to check answer:", err);
        toast.error("Failed to check answer");
      }
    },
    [deckStudy, inputAnswer, settings, mode, toast]
  );

  const handleManualAnswer = async (isCorrect: boolean) => {
    if (!deckStudy.currentPhrase) return;

    const phraseId = deckStudy.currentPhrase.phrase.id;
    setFeedback(isCorrect ? "correct" : "incorrect");

    try {
      await deckStudy.recordAnswer(phraseId, isCorrect);
    } catch (err) {
      console.error("Failed to record answer:", err);
    }
    setAwaitingProceed(true);
  };

  const handlePlayAnswer = useCallback(() => {
    if (!deckStudy.currentPhrase) return;
    tts.speak(
      deckStudy.currentPhrase.phrase.answer,
      deckStudy.currentPhrase.phrase.id,
      deckStudy.currentPhrase.phrase.audioPath || undefined,
      deckStudy.currentPhrase.phrase.targetLanguage
    );
  }, [deckStudy.currentPhrase, tts]);

  const handleProceedToNext = useCallback(() => {
    if (!deckStudy.currentPhrase || !awaitingProceed) return;

    // For deck study, we don't exclude phrases permanently
    // They can come back after their next_review_at time
    deckStudy.markPhraseSeen(deckStudy.currentPhrase.phrase.id);

    setAwaitingProceed(false);
    setFeedback(null);
    setInputAnswer("");
        setShowAnswer(false);
    deckStudy.loadNextPhrase();
  }, [deckStudy, awaitingProceed]);

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
    await deckStudy.endSession();
    onNavigate("deck-detail", { deckId });
  };

  const handleBack = () => {
    onNavigate("deck-detail", { deckId });
  };

  const handleShowAnswerSkip = async () => {
    if (!deckStudy.currentPhrase) return;
    const phraseId = deckStudy.currentPhrase.phrase.id;

    await deckStudy.recordAnswer(phraseId, false);

    setShowAnswer(true);
    setFeedback("incorrect");
    deckStudy.setInRetryMode(true);
    deckStudy.setRetryCount(0);
    deckStudy.setRequiresRetry(true);
  };

  const handleSpeakingNext = () => {
    if (!deckStudy.currentPhrase) return;
    deckStudy.markPhraseSeen(deckStudy.currentPhrase.phrase.id);
    setShowAnswer(false);
    setFeedback(null);
    setInputAnswer("");
        setAwaitingProceed(false);
    deckStudy.loadNextPhrase();
  };

  const handleStartSession = async () => {
    await deckStudy.startSession(mode);
  };

  // Loading state
  if (deckLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500 dark:text-slate-400">Deck not found</div>
      </div>
    );
  }

  // Not in a session - show start options
  if (!deckStudy.session) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            Back
          </Button>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
          Study: {deck.name}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          {deck.graduationThreshold} correct answers to graduate a phrase to SRS
        </p>

        <ModeSelector mode={mode} onModeChange={setMode} />

        <Button
          onClick={handleStartSession}
          disabled={deckStudy.isLoading}
          isLoading={deckStudy.isLoading}
          className="w-full py-4 text-lg"
        >
          Start Studying
        </Button>
      </div>
    );
  }

  // No more phrases
  if (!deckStudy.currentPhrase && !deckStudy.isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <EmptyState
          icon={
            <BookIcon size="xl" className="text-slate-300 dark:text-slate-600" />
          }
          title="Session Complete"
          description={
            deckStudy.seenPhraseIds.length > 0
              ? `Great work! You practiced ${deckStudy.seenPhraseIds.length} phrases and graduated ${deckStudy.graduatedCount}.`
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

  const currentPhrase = deckStudy.currentPhrase;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <DeckStudyHeader
        deckName={deck.name}
        seenCount={deckStudy.seenPhraseIds.length}
        correctCount={deckStudy.session.correctAnswers || 0}
        graduatedCount={deckStudy.graduatedCount}
        graduationThreshold={deck.graduationThreshold}
        onEndSession={handleEndSession}
        onBack={handleBack}
      />

      {deckStudy.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : currentPhrase ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          {/* Progress indicator for current phrase */}
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

          <ExercisePrompt
            prompt={currentPhrase.phrase.prompt}
            onExclude={() => {
              // For deck study, phrases stay in deck - just skip this one
              deckStudy.markPhraseSeen(currentPhrase.phrase.id);
              deckStudy.loadNextPhrase();
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

          {deckStudy.inRetryMode && mode === "speaking" && settings && (
            <RetryModeMessage
              remainingRetries={(settings.failureRepetitions || 3) - deckStudy.retryCount}
            />
          )}

          {feedback === "incorrect" &&
            !(deckStudy.inRetryMode && mode === "speaking") && (
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

          {mode === "speaking" && (!feedback || deckStudy.inRetryMode) && (
            <SpeakingExercise
              inputAnswer={inputAnswer}
              answer={currentPhrase.phrase.answer}
              showAnswer={showAnswer}
              inRetryMode={deckStudy.inRetryMode}
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
            !deckStudy.inRetryMode && (
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

          {deckStudy.requiresRetry && !feedback && !deckStudy.inRetryMode && (
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
              deckStudy.currentPhrase &&
              deckStudy.currentPhrase.phrase.id === refiningPhrase.phrase.id
            ) {
              deckStudy.setCurrentPhrase({
                ...deckStudy.currentPhrase,
                phrase: { ...deckStudy.currentPhrase.phrase, prompt, answer, accepted, refined: true },
              });
            }
          }}
          onAudioRegenerated={(audioPath) => {
            if (
              deckStudy.currentPhrase &&
              deckStudy.currentPhrase.phrase.id === refiningPhrase.phrase.id
            ) {
              deckStudy.setCurrentPhrase({
                ...deckStudy.currentPhrase,
                phrase: { ...deckStudy.currentPhrase.phrase, audioPath },
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
