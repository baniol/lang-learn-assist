import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useTTS } from "../hooks/useTTS";
import {
  getPhrases,
  getTags,
  checkExerciseAnswer,
  saveExerciseSession,
  toggleStarred,
} from "../api";
import { VoiceButton } from "../components/VoiceButton";
import { Button, Spinner } from "../components/ui";
import {
  PlayIcon,
  CheckIcon,
  CloseIcon,
  RefreshIcon,
  ChevronRightIcon,
  VolumeUpIcon,
  VolumeOffIcon,
  EyeIcon,
  EyeOffIcon,
  MicrophoneIcon,
  EditIcon,
  StarIcon,
} from "../components/icons";
import { cn } from "../lib/utils";
import type { Tag, ExercisePhase, ExerciseSessionPhrase, CheckAnswerResult } from "../types";

type InputMode = "typing" | "voice" | "repeat";

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function PhraseExerciseView() {
  const { settings } = useSettings();
  const [phase, setPhase] = useState<ExercisePhase>("setup");
  const [inputMode, setInputMode] = useState<InputMode>("voice");

  // Setup state
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [starredOnly, setStarredOnly] = useState(false);
  const [phraseCount, setPhraseCount] = useState<number | null>(null);
  const [isLoadingPhrases, setIsLoadingPhrases] = useState(false);

  // Exercise state
  const [sessionPhrases, setSessionPhrases] = useState<ExerciseSessionPhrase[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [lastResult, setLastResult] = useState<CheckAnswerResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [showingAnswer, setShowingAnswer] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [showSentence, setShowSentence] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const repetitionsRequired = settings?.exerciseRepetitionsRequired ?? 1;
  const fuzzyMatching = settings?.fuzzyMatching ?? true;
  const targetLanguage = settings?.targetLanguage ?? "de";

  const currentPhrase = sessionPhrases[currentIndex] ?? null;
  const completedCount = sessionPhrases.filter((sp) => sp.completed).length;
  const totalCount = sessionPhrases.length;

  // TTS
  const { speak: ttsSpeak } = useTTS({ enabled: true });

  // Submit answer - defined before voice recording so ref is available
  const submitAnswer = useCallback(
    async (answer?: string) => {
      const text = (answer ?? inputValue).trim();
      if (!text || isChecking || !currentPhrase || lastResult) return;

      setIsChecking(true);
      try {
        const result = await checkExerciseAnswer(
          text,
          currentPhrase.phrase.answer,
          currentPhrase.phrase.accepted,
          fuzzyMatching
        );

        if (!mountedRef.current) return;
        setLastResult(result);

        setSessionPhrases((prev) => {
          const updated = [...prev];
          const item = { ...updated[currentIndex] };
          item.attempts += 1;

          if (result.correct) {
            item.correctStreak += 1;
            // No prior failure: complete immediately. After failure: need repetitionsRequired in a row.
            if (!item.hasFailed || item.correctStreak >= repetitionsRequired) {
              item.completed = true;
            }
          } else {
            item.hasFailed = true;
            item.correctStreak = 0;
          }

          updated[currentIndex] = item;
          return updated;
        });
      } catch (err) {
        console.error("Failed to check answer:", err);
      } finally {
        if (mountedRef.current) setIsChecking(false);
      }
    },
    [
      inputValue,
      isChecking,
      currentPhrase,
      lastResult,
      currentIndex,
      fuzzyMatching,
      repetitionsRequired,
    ]
  );

  // Store submitAnswer in ref for voice transcription callback
  const submitAnswerRef = useRef(submitAnswer);
  submitAnswerRef.current = submitAnswer;

  // Voice recording - auto-submit after transcription
  const handleTranscription = useCallback((text: string) => {
    setInputValue(text);
    if (text.trim()) {
      submitAnswerRef.current?.(text);
    }
  }, []);

  const {
    status: voiceStatus,
    isAvailable: voiceAvailable,
    startRecording,
    stopRecording,
  } = useVoiceRecording({
    enabled:
      (inputMode === "voice" || inputMode === "repeat") && phase === "exercise" && !lastResult,
    language: targetLanguage,
    prompt: currentPhrase?.phrase.answer,
    onTranscription: handleTranscription,
    // In voice mode, Space is NOT disabled - it triggers press-and-hold recording
    // since there's no text input to conflict with
    disableSpaceKey: false,
  });

  // Toggle starred on current phrase
  const handleToggleStar = useCallback(async () => {
    if (!currentPhrase) return;
    try {
      const newStarred = await toggleStarred(currentPhrase.phrase.id);
      setSessionPhrases((prev) =>
        prev.map((sp) =>
          sp.phrase.id === currentPhrase.phrase.id
            ? { ...sp, phrase: { ...sp.phrase, starred: newStarred } }
            : sp
        )
      );
    } catch (err) {
      console.error("Failed to toggle starred:", err);
    }
  }, [currentPhrase]);

  // Load tags on mount
  useEffect(() => {
    getTags().then(setTags).catch(console.error);
  }, []);

  // Load phrase count when filter changes
  useEffect(() => {
    if (!settings) return;
    setIsLoadingPhrases(true);
    getPhrases({
      targetLanguage,
      tagId: selectedTagId ?? undefined,
      starredOnly: starredOnly || undefined,
    })
      .then((phrases) => {
        if (mountedRef.current) {
          setPhraseCount(phrases.length);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (mountedRef.current) setIsLoadingPhrases(false);
      });
  }, [selectedTagId, starredOnly, targetLanguage, settings]);

  // Start exercise
  const handleStart = useCallback(async () => {
    try {
      const phrases = await getPhrases({
        targetLanguage,
        tagId: selectedTagId ?? undefined,
        starredOnly: starredOnly || undefined,
      });
      if (phrases.length === 0) return;

      const shuffled = shuffleArray(phrases);
      const session: ExerciseSessionPhrase[] = shuffled.map((phrase) => ({
        phrase,
        correctStreak: 0,
        attempts: 0,
        completed: false,
        hasFailed: false,
      }));

      setSessionPhrases(session);
      setCurrentIndex(0);
      setInputValue("");
      setLastResult(null);
      setStartTime(Date.now());
      setPhase("exercise");
      if (inputMode === "typing") {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (err) {
      console.error("Failed to start exercise:", err);
    }
  }, [targetLanguage, selectedTagId, starredOnly, inputMode]);

  // Save session and transition to results
  const handleFinish = useCallback(
    (phrases: typeof sessionPhrases) => {
      const completed = phrases.filter((sp) => sp.completed).length;
      const total = phrases.length;
      const date = new Date().toISOString().split("T")[0];
      const phraseDetails = phrases.map((sp) => ({
        prompt: sp.phrase.prompt,
        answer: sp.phrase.answer,
        attempts: sp.attempts,
        completed: sp.completed,
      }));
      saveExerciseSession(date, completed, total, targetLanguage, phraseDetails).catch(
        console.error
      );
      setPhase("results");
    },
    [targetLanguage]
  );

  // Advance: stay on same phrase until completed, then move to next
  const handleNext = useCallback(() => {
    setLastResult(null);
    setInputValue("");
    setShowingAnswer(false);

    // If current phrase is NOT completed, stay on it (repeat until correct)
    const current = sessionPhrases[currentIndex];
    if (current && !current.completed) {
      if (inputMode === "typing") {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      return;
    }

    // Current phrase completed - find next uncompleted
    const uncompleted = sessionPhrases
      .map((sp, i) => ({ sp, i }))
      .filter(({ sp }) => !sp.completed);

    if (uncompleted.length === 0) {
      handleFinish(sessionPhrases);
      return;
    }

    if (uncompleted.length === 1) {
      setCurrentIndex(uncompleted[0].i);
    } else {
      // Pick next uncompleted, preferring ones at least 2 positions away
      const farAway = uncompleted.filter(({ i }) => Math.abs(i - currentIndex) >= 2);
      const candidates =
        farAway.length > 0 ? farAway : uncompleted.filter(({ i }) => i !== currentIndex);
      const pick = candidates.length > 0 ? candidates : uncompleted;
      const nextIdx = pick[Math.floor(Math.random() * pick.length)].i;
      setCurrentIndex(nextIdx);
    }

    if (inputMode === "typing") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [sessionPhrases, currentIndex, inputMode, handleFinish]);

  // Handle Enter key in typing mode
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (lastResult) {
          handleNext();
        } else {
          submitAnswer();
        }
      }
    },
    [lastResult, handleNext, submitAnswer]
  );

  // Play correct answer TTS
  const handlePlayAnswer = useCallback(() => {
    if (currentPhrase) {
      ttsSpeak(
        currentPhrase.phrase.answer,
        currentPhrase.phrase.id,
        currentPhrase.phrase.audioPath ?? undefined,
        currentPhrase.phrase.targetLanguage
      );
    }
  }, [currentPhrase, ttsSpeak]);

  // Auto-play TTS in repeat mode when phrase changes
  useEffect(() => {
    if (
      phase !== "exercise" ||
      inputMode !== "repeat" ||
      (!autoPlayAudio && showSentence) ||
      !currentPhrase ||
      lastResult
    )
      return;
    ttsSpeak(
      currentPhrase.phrase.answer,
      currentPhrase.phrase.id,
      currentPhrase.phrase.audioPath ?? undefined,
      currentPhrase.phrase.targetLanguage
    );
  }, [
    phase,
    inputMode,
    autoPlayAudio,
    showSentence,
    currentIndex,
    currentPhrase,
    lastResult,
    ttsSpeak,
  ]);

  // Keyboard shortcuts when result is showing
  useEffect(() => {
    if (phase !== "exercise" || !lastResult) return;

    const handleKey = (e: KeyboardEvent) => {
      // P = play answer audio
      if (e.code === "KeyP") {
        e.preventDefault();
        handlePlayAnswer();
        return;
      }
      // Space = next (voice/repeat mode, typing mode uses Enter via input)
      if (e.code === "Space" && (inputMode === "voice" || inputMode === "repeat")) {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, lastResult, inputMode, handleNext, handlePlayAnswer]);

  // Peek at correct answer (resets streak, marks as failed)
  const handlePeekAnswer = useCallback(() => {
    setShowingAnswer(true);
    setSessionPhrases((prev) => {
      const updated = [...prev];
      const item = { ...updated[currentIndex] };
      item.correctStreak = 0;
      item.hasFailed = true;
      updated[currentIndex] = item;
      return updated;
    });
  }, [currentIndex]);

  // Results stats
  const totalAttempts = useMemo(
    () => sessionPhrases.reduce((sum, sp) => sum + sp.attempts, 0),
    [sessionPhrases]
  );
  const correctAttempts = useMemo(
    () => sessionPhrases.reduce((sum, sp) => sum + sp.correctStreak, 0),
    [sessionPhrases]
  );
  const elapsedSeconds = useMemo(
    () => (phase === "results" ? Math.round((Date.now() - startTime) / 1000) : 0),
    [phase, startTime]
  );

  // ============================================================================
  // SETUP PHASE
  // ============================================================================
  if (phase === "setup") {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Phrase Exercise</h1>

        <div className="space-y-4">
          {/* Input mode selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Input Mode
            </label>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setInputMode("voice")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  inputMode === "voice"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <MicrophoneIcon size="sm" />
                Voice
              </button>
              <button
                onClick={() => setInputMode("typing")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  inputMode === "typing"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <EditIcon size="sm" />
                Typing
              </button>
              <button
                onClick={() => setInputMode("repeat")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  inputMode === "repeat"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <RefreshIcon size="sm" />
                Repeat
              </button>
            </div>
          </div>

          {/* Tag selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Exercise Set
            </label>
            <select
              value={selectedTagId ?? ""}
              onChange={(e) => setSelectedTagId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            >
              <option value="">All phrases</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>

          {/* Starred only toggle */}
          <div>
            <button
              onClick={() => setStarredOnly((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors w-full",
                starredOnly
                  ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
              )}
            >
              <StarIcon size="sm" filled={starredOnly} />
              {starredOnly ? "Starred phrases only" : "All phrases (including unstarred)"}
            </button>
          </div>

          {/* Phrase count */}
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {isLoadingPhrases ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Spinner size="sm" />
                <span>Loading phrases...</span>
              </div>
            ) : (
              <div className="text-slate-700 dark:text-slate-300">
                <span className="text-2xl font-bold text-slate-800 dark:text-white">
                  {phraseCount ?? 0}
                </span>{" "}
                phrases available
              </div>
            )}
          </div>

          {/* Repetitions info */}
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Required correct in a row:{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {repetitionsRequired}
            </span>
            <span className="text-slate-400 dark:text-slate-500 ml-1">(change in Settings)</span>
          </div>

          {/* Start button */}
          <Button
            onClick={handleStart}
            disabled={!phraseCount || phraseCount === 0 || isLoadingPhrases}
            className="w-full"
          >
            <PlayIcon size="sm" />
            Start Exercise
          </Button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // EXERCISE PHASE
  // ============================================================================
  if (phase === "exercise" && currentPhrase) {
    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
      <div className="flex flex-col h-full">
        {/* Header with progress */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Exercise</h2>
              {/* Input mode indicator */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                {inputMode === "voice" ? (
                  <>
                    <MicrophoneIcon size="xs" /> Voice
                  </>
                ) : inputMode === "repeat" ? (
                  <>
                    <RefreshIcon size="xs" /> Repeat
                  </>
                ) : (
                  <>
                    <EditIcon size="xs" /> Typing
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {completedCount}/{totalCount} completed
              </span>
              {inputMode === "repeat" && (
                <>
                  <button
                    onClick={() => {
                      setShowSentence((v) => {
                        if (v) setAutoPlayAudio(true);
                        return !v;
                      });
                    }}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      showSentence
                        ? "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    )}
                    title={showSentence ? "Text visible" : "Text hidden (audio only)"}
                  >
                    {showSentence ? <EyeIcon size="sm" /> : <EyeOffIcon size="sm" />}
                  </button>
                  <button
                    onClick={() => setAutoPlayAudio((v) => !v)}
                    disabled={!showSentence}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      !showSentence
                        ? "text-blue-600/50 dark:text-blue-400/50 cursor-not-allowed"
                        : autoPlayAudio
                          ? "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    )}
                    title={
                      !showSentence
                        ? "Auto-play required when text is hidden"
                        : autoPlayAudio
                          ? "Auto-play on"
                          : "Auto-play off"
                    }
                  >
                    {autoPlayAudio || !showSentence ? (
                      <VolumeUpIcon size="sm" />
                    ) : (
                      <VolumeOffIcon size="sm" />
                    )}
                  </button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => handleFinish(sessionPhrases)}>
                End
              </Button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Main exercise area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {/* Streak indicator */}
          {repetitionsRequired > 1 && (
            <div className="flex items-center gap-1 mb-4">
              {Array.from({ length: repetitionsRequired }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full transition-colors",
                    i < currentPhrase.correctStreak
                      ? "bg-green-500"
                      : "bg-slate-300 dark:bg-slate-600"
                  )}
                />
              ))}
            </div>
          )}

          {/* Star + Prompt */}
          <div className="text-center mb-8">
            <button
              onClick={handleToggleStar}
              className={cn(
                "mb-2 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors",
                currentPhrase.phrase.starred
                  ? "text-yellow-500"
                  : "text-slate-300 dark:text-slate-600"
              )}
              title={currentPhrase.phrase.starred ? "Unstar phrase" : "Star phrase"}
            >
              <StarIcon size="md" filled={currentPhrase.phrase.starred} />
            </button>
            {inputMode === "repeat" ? (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  {showSentence ? "Repeat:" : "Listen and repeat:"}
                </p>
                {showSentence && (
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">
                    {currentPhrase.phrase.answer}
                  </p>
                )}
                {!lastResult && (
                  <button
                    onClick={handlePlayAnswer}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-500 transition-colors"
                    title="Listen (P)"
                  >
                    <VolumeUpIcon size="sm" />
                    Listen
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Translate:</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                  {currentPhrase.phrase.prompt}
                </p>

                {/* Peek answer */}
                {!lastResult &&
                  (showingAnswer ? (
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        {currentPhrase.phrase.answer}
                      </p>
                      <button
                        onClick={handlePlayAnswer}
                        className="p-1 text-amber-600 hover:text-amber-800 dark:hover:text-amber-200 transition-colors rounded"
                        title="Listen"
                      >
                        <VolumeUpIcon size="sm" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handlePeekAnswer}
                      className="mt-3 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors underline underline-offset-2"
                    >
                      Show answer
                    </button>
                  ))}
              </>
            )}
          </div>

          {/* Answer feedback */}
          {lastResult && (
            <div
              className={cn(
                "w-full max-w-md mb-6 p-4 rounded-lg border",
                lastResult.correct
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex-shrink-0",
                    lastResult.correct ? "text-green-600" : "text-red-600"
                  )}
                >
                  {lastResult.correct ? <CheckIcon size="md" /> : <CloseIcon size="md" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "font-medium",
                      lastResult.correct
                        ? "text-green-800 dark:text-green-300"
                        : "text-red-800 dark:text-red-300"
                    )}
                  >
                    {lastResult.correct
                      ? currentPhrase.completed
                        ? "Correct! Phrase completed."
                        : `Correct! Repeat to confirm (${currentPhrase.correctStreak}/${repetitionsRequired})`
                      : "Incorrect — try again"}
                  </p>
                  {lastResult.correct && (
                    <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                      Answer: <span className="font-medium">{lastResult.expectedAnswer}</span>
                    </p>
                  )}
                  {lastResult.correct &&
                    inputValue &&
                    inputValue.trim().toLowerCase() !==
                      lastResult.expectedAnswer.trim().toLowerCase() && (
                      <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                        Recognized: <span className="italic">&ldquo;{inputValue}&rdquo;</span>
                        {lastResult.similarity < 1.0 && (
                          <span className="ml-1">({Math.round(lastResult.similarity * 100)}%)</span>
                        )}
                      </p>
                    )}
                  {!lastResult.correct && (
                    <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">
                      Expected: <span className="font-medium">{lastResult.expectedAnswer}</span>
                    </p>
                  )}
                  {!lastResult.correct && inputValue && (
                    <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                      Recognized: <span className="italic">&ldquo;{inputValue}&rdquo;</span>
                      {lastResult.similarity > 0 && (
                        <span className="ml-1">({Math.round(lastResult.similarity * 100)}%)</span>
                      )}
                    </p>
                  )}
                  {lastResult.matchedAlternative && (
                    <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                      Matched alternative: {lastResult.matchedAlternative}
                    </p>
                  )}
                </div>
                <button
                  onClick={handlePlayAnswer}
                  className="flex-shrink-0 p-1.5 text-slate-500 hover:text-blue-600 transition-colors rounded"
                  title="Listen to answer (P)"
                >
                  <VolumeUpIcon size="sm" />
                </button>
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="w-full max-w-md">
            {!lastResult ? (
              inputMode === "voice" || inputMode === "repeat" ? (
                /* VOICE/REPEAT MODE: large central mic button, Space press-and-hold */
                <div className="flex flex-col items-center gap-4">
                  <VoiceButton
                    status={voiceStatus}
                    isAvailable={voiceAvailable}
                    onPress={startRecording}
                    onRelease={stopRecording}
                    size="lg"
                  />
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    {voiceStatus === "recording"
                      ? "Listening... release to stop"
                      : voiceStatus === "transcribing"
                        ? "Transcribing..."
                        : "Hold Space or press the mic button"}
                  </p>
                  {inputValue && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 italic">
                      &ldquo;{inputValue}&rdquo;
                    </p>
                  )}
                </div>
              ) : (
                /* TYPING MODE: text input with submit button */
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your answer..."
                    disabled={isChecking}
                    className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                    autoFocus
                  />
                  <Button
                    onClick={() => submitAnswer()}
                    disabled={!inputValue.trim() || isChecking}
                    isLoading={isChecking}
                  >
                    Check
                  </Button>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Button onClick={handleNext} className="w-full" size="lg">
                  {currentPhrase.completed
                    ? completedCount === totalCount
                      ? "See Results"
                      : "Next Phrase"
                    : "Try Again"}
                  <ChevronRightIcon size="sm" />
                </Button>
                {(inputMode === "voice" || inputMode === "repeat") && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Press Space to continue
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RESULTS PHASE
  // ============================================================================
  if (phase === "results") {
    const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    return (
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
          Exercise Complete
        </h1>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {completedCount}/{totalCount}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Phrases done</p>
          </div>
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{accuracy}%</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Accuracy</p>
          </div>
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Time</p>
          </div>
        </div>

        {/* Phrase details */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Phrase Details
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {sessionPhrases.map((sp) => (
              <div
                key={sp.phrase.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  sp.completed && sp.attempts <= 1
                    ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
                    : sp.completed && sp.attempts > 1
                      ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0",
                    sp.completed && sp.attempts <= 1
                      ? "text-green-600"
                      : sp.completed && sp.attempts > 1
                        ? "text-amber-600"
                        : "text-slate-400"
                  )}
                >
                  {sp.completed ? <CheckIcon size="sm" /> : <CloseIcon size="sm" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                    {sp.phrase.prompt}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {sp.phrase.answer}
                  </p>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                  {sp.attempts} {sp.attempts === 1 ? "attempt" : "attempts"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setPhase("setup");
              setSessionPhrases([]);
              setLastResult(null);
              setInputValue("");
            }}
            variant="secondary"
            className="flex-1"
          >
            Back to Setup
          </Button>
          <Button onClick={handleStart} className="flex-1">
            <RefreshIcon size="sm" />
            Practice Again
          </Button>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
