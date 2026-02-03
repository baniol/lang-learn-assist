import { cn } from "../../lib/utils";
import type { PhraseProgress } from "../../types";
import { LEARNING } from "../../lib/constants";

interface PhraseStatusBadgeProps {
  progress: PhraseProgress | null;
}

export function PhraseStatusBadge({ progress }: PhraseStatusBadgeProps) {
  const isLearned =
    progress && progress.correctStreak >= LEARNING.DEFAULT_REQUIRED_STREAK;
  const isLearning = progress && progress.totalAttempts > 0 && !isLearned;

  const status = isLearned ? "learned" : isLearning ? "learning" : "new";

  return (
    <div className="relative group/status flex-shrink-0">
      <span
        className={cn(
          "text-xs font-medium px-2 py-1 rounded cursor-help",
          status === "learned" &&
            "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
          status === "learning" &&
            "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
          status === "new" &&
            "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
        )}
      >
        {status === "learned"
          ? "Learned"
          : status === "learning"
            ? "Learning"
            : "New"}
      </span>

      {/* Tooltip */}
      <div className="absolute right-0 top-full mt-1 z-10 invisible group-hover/status:visible opacity-0 group-hover/status:opacity-100 transition-opacity">
        <div className="bg-slate-800 dark:bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
          {progress ? (
            <div className="space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Streak:</span>
                <span>{progress.correctStreak} correct</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Success:</span>
                <span>
                  {progress.totalAttempts > 0
                    ? Math.round(
                        (progress.successCount / progress.totalAttempts) * 100
                      )
                    : 0}
                  % ({progress.successCount}/{progress.totalAttempts})
                </span>
              </div>
              {progress.nextReviewAt && (
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Review:</span>
                  <span>
                    {new Date(progress.nextReviewAt).toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                      }
                    )}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-400">Not yet practiced</span>
          )}
        </div>
      </div>
    </div>
  );
}
