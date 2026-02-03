import type { PhraseWithProgress } from "../types";
import { StarIcon, PlayIcon, PauseIcon, EditIcon, TrashIcon } from "./icons";

interface PhraseCardProps {
  phrase: PhraseWithProgress;
  onToggleStar?: () => void;
  onPlay?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isPlaying?: boolean;
}

export function PhraseCard({
  phrase,
  onToggleStar,
  onPlay,
  onEdit,
  onDelete,
  isPlaying,
}: PhraseCardProps) {
  const { phrase: p, progress } = phrase;

  const getStatusColor = () => {
    if (!progress || progress.totalAttempts === 0) {
      return "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300";
    }
    if (progress.correctStreak >= 2) {
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
    }
    return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
  };

  const getStatusText = () => {
    if (!progress || progress.totalAttempts === 0) return "New";
    if (progress.correctStreak >= 2) return "Learned";
    return "Learning";
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        <button
          onClick={onToggleStar}
          className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
            p.starred ? "text-yellow-500" : "text-slate-400"
          }`}
        >
          <StarIcon size="md" filled={p.starred} />
        </button>
      </div>

      <div className="space-y-2 mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{p.prompt}</p>
        <p className="text-lg font-medium text-slate-800 dark:text-white">{p.answer}</p>
        {p.accepted.length > 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Also: {p.accepted.join(", ")}
          </p>
        )}
      </div>

      {progress && progress.totalAttempts > 0 && (
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-3">
          <span>
            {progress.successCount}/{progress.totalAttempts} correct
          </span>
          <span>Streak: {progress.correctStreak}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {onPlay && (
          <button
            onClick={onPlay}
            disabled={isPlaying}
            className="p-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-50 transition-colors"
          >
            {isPlaying ? (
              <PauseIcon size="sm" className="animate-pulse" />
            ) : (
              <PlayIcon size="sm" />
            )}
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <EditIcon size="sm" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            <TrashIcon size="sm" />
          </button>
        )}
      </div>
    </div>
  );
}
