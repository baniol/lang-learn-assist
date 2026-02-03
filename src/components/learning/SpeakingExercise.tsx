import { VoiceButton } from "../VoiceButton";
import { Button } from "../ui";
import { PlayIcon } from "../icons";
import type { RecordingStatus } from "../../hooks/useVoiceRecording";

interface SpeakingExerciseProps {
  inputAnswer: string;
  answer: string;
  showAnswer: boolean;
  inRetryMode: boolean;
  isAvailable: boolean;
  status: RecordingStatus;
  isPlaying: boolean;
  isLoading: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onShowAnswer: () => void;
  onPlayAudio: () => void;
  onNext: () => void;
}

export function SpeakingExercise({
  inputAnswer,
  answer,
  showAnswer,
  inRetryMode,
  isAvailable,
  status,
  isPlaying,
  isLoading,
  onStartRecording,
  onStopRecording,
  onShowAnswer,
  onPlayAudio,
  onNext,
}: SpeakingExerciseProps) {
  // After showing answer via skip, show the answer and Next button
  if (showAnswer && !inRetryMode) {
    return (
      <div className="text-center space-y-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
          <p className="text-xl font-medium text-slate-800 dark:text-white">
            {answer}
          </p>
          <button
            onClick={onPlayAudio}
            disabled={isPlaying || isLoading}
            className="mt-2 p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
          >
            <PlayIcon size="sm" />
          </button>
        </div>
        <Button onClick={onNext} className="w-full">
          Next
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {inRetryMode
          ? "Speak the correct answer"
          : "Press and hold to record your answer"}
      </p>
      <div className="flex justify-center">
        <VoiceButton
          status={status}
          isAvailable={isAvailable}
          onPress={onStartRecording}
          onRelease={onStopRecording}
          size="lg"
        />
      </div>
      {inputAnswer && !inRetryMode && (
        <p className="text-slate-600 dark:text-slate-300">
          Heard: "{inputAnswer}"
        </p>
      )}
      {!isAvailable && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Voice recording not available. Download a Whisper model in Settings.
        </p>
      )}
      {/* Show Answer button - reveals answer but counts as incorrect and enters retry mode */}
      {!inRetryMode && !showAnswer && (
        <button
          onClick={onShowAnswer}
          className="mt-4 px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm"
        >
          Show Answer (skip)
        </button>
      )}
    </div>
  );
}
