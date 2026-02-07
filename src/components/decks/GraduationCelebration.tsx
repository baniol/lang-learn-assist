import { useEffect } from "react";
import { Button } from "../ui";
import { CheckCircleIcon } from "../icons";
import type { DeckAnswerResult } from "../../types";

interface GraduationCelebrationProps {
  result: DeckAnswerResult;
  phraseName: string;
  onContinue: () => void;
}

export function GraduationCelebration({
  result,
  phraseName,
  onContinue,
}: GraduationCelebrationProps) {
  // Auto-continue after delay
  useEffect(() => {
    const timer = setTimeout(onContinue, 3000);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-8 text-center animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircleIcon size="xl" className="text-green-500" />
        </div>

        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
          Phrase Graduated!
        </h2>

        <p className="text-slate-600 dark:text-slate-300 mb-4">
          &ldquo;{phraseName}&rdquo;
        </p>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          This phrase has been added to your SRS review pool.
          You&apos;ll see it again during regular practice sessions.
        </p>

        <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 mb-6">
          <span className="font-semibold">
            {result.deckCorrectCount}/{result.graduationThreshold}
          </span>
          <span>correct answers</span>
        </div>

        <Button onClick={onContinue} className="w-full">
          Continue
        </Button>

        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
          Continuing automatically...
        </p>
      </div>
    </div>
  );
}
