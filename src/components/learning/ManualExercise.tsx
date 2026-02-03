import { Button } from "../ui";
import { PlayIcon } from "../icons";

interface ManualExerciseProps {
  answer: string;
  showAnswer: boolean;
  hasFeedback: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  onShowAnswer: () => void;
  onPlayAudio: () => void;
  onGrade: (isCorrect: boolean) => void;
}

export function ManualExercise({
  answer,
  showAnswer,
  hasFeedback,
  isPlaying,
  isLoading,
  onShowAnswer,
  onPlayAudio,
  onGrade,
}: ManualExerciseProps) {
  if (!showAnswer) {
    return (
      <Button onClick={onShowAnswer} variant="secondary" className="w-full py-4">
        Show Answer
      </Button>
    );
  }

  return (
    <>
      <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
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
      {!hasFeedback && (
        <div className="flex gap-4 mt-4">
          <Button
            onClick={() => onGrade(false)}
            variant="danger"
            className="flex-1 py-4"
          >
            Incorrect
          </Button>
          <Button
            onClick={() => onGrade(true)}
            variant="success"
            className="flex-1 py-4"
          >
            Correct
          </Button>
        </div>
      )}
    </>
  );
}
