import { cn } from "../../lib/utils";
import { Button } from "../ui";
import { PlayIcon, LightbulbIcon } from "../icons";

interface FeedbackDisplayProps {
  type: "correct" | "incorrect";
  correctAnswer: string;
  userAnswer?: string;
  onPlayAudio: () => void;
  onProceed?: () => void;
  onOverride?: () => void;
  onAskAI?: () => void;
  isPlaying?: boolean;
  isLoading?: boolean;
  showProceed?: boolean;
  showOverride?: boolean;
}

export function FeedbackDisplay({
  type,
  correctAnswer,
  userAnswer,
  onPlayAudio,
  onProceed,
  onOverride,
  onAskAI,
  isPlaying,
  isLoading,
  showProceed,
  showOverride,
}: FeedbackDisplayProps) {
  const isCorrect = type === "correct";

  return (
    <div
      className={cn(
        "text-center py-4 rounded-lg mb-6",
        isCorrect
          ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
          : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
      )}
    >
      <p className="text-lg font-medium">
        {isCorrect ? "Correct!" : "Not quite..."}
      </p>

      {isCorrect && showProceed && (
        <>
          <p className="text-lg mt-2">
            <strong>{correctAnswer}</strong>
          </p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={onPlayAudio}
              disabled={isPlaying || isLoading}
              className="p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-full transition-colors inline-flex items-center justify-center"
              title="Listen to pronunciation (P)"
            >
              <PlayIcon size="sm" />
            </button>
            <Button onClick={onProceed} variant="success">
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

      {!isCorrect && (
        <>
          {userAnswer && (
            <p className="text-sm mt-1">
              You said: <strong>"{userAnswer}"</strong>
            </p>
          )}
          <p className="text-sm mt-1">
            Correct answer: <strong>{correctAnswer}</strong>
          </p>
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              onClick={onPlayAudio}
              disabled={isPlaying || isLoading}
              className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors inline-flex items-center justify-center"
              title="Listen to pronunciation"
            >
              <PlayIcon size="sm" />
            </button>
            {showOverride && onOverride && (
              <Button onClick={onOverride} variant="success" size="sm">
                I said it correctly
              </Button>
            )}
            {onAskAI && (
              <button
                onClick={onAskAI}
                className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium flex items-center gap-1.5"
                title="Ask AI if your answer is correct"
              >
                <LightbulbIcon size="xs" />
                Ask AI
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
