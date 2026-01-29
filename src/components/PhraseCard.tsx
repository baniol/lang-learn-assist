import type { PhraseWithProgress } from "../types";

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
          <svg className="w-5 h-5" fill={p.starred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
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
              <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
