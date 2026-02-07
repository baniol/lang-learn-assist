import { cn } from "../../lib/utils";
import { Spinner } from "../ui";
import {
  PlayIcon,
  PauseIcon,
  LightbulbIcon,
  CheckCircleIcon,
  ExcludeIcon,
  CloseIcon,
  DecksIcon,
} from "../icons";

interface PhraseActionsProps {
  phraseId: number;
  isExcluded: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  hasDeck?: boolean;
  onPlay: () => void;
  onRefine: () => void;
  onToggleExcluded: () => void;
  onDelete: () => void;
  onAssignToDeck?: () => void;
}

export function PhraseActions({
  isExcluded,
  isPlaying,
  isLoading,
  hasDeck,
  onPlay,
  onRefine,
  onToggleExcluded,
  onDelete,
  onAssignToDeck,
}: PhraseActionsProps) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        onClick={onPlay}
        disabled={isLoading}
        className="p-2 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors"
        title="Play"
      >
        {isLoading ? (
          <Spinner size="sm" />
        ) : isPlaying ? (
          <PauseIcon size="xs" />
        ) : (
          <PlayIcon size="xs" />
        )}
      </button>
      <button
        onClick={onRefine}
        className="p-2 rounded text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors opacity-0 group-hover:opacity-100"
        title="Refine with AI"
      >
        <LightbulbIcon size="xs" />
      </button>
      {onAssignToDeck && (
        <button
          onClick={onAssignToDeck}
          className={cn(
            "p-2 rounded transition-colors opacity-0 group-hover:opacity-100",
            hasDeck
              ? "text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30"
              : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          )}
          title={hasDeck ? "Change deck" : "Add to deck"}
        >
          <DecksIcon size="xs" />
        </button>
      )}
      <button
        onClick={onToggleExcluded}
        className={cn(
          "p-2 rounded transition-colors opacity-0 group-hover:opacity-100",
          isExcluded
            ? "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
            : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
        )}
        title={isExcluded ? "Include in learning" : "Exclude from learning"}
      >
        {isExcluded ? <CheckCircleIcon size="xs" /> : <ExcludeIcon size="xs" />}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-2 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
        title="Delete"
      >
        <CloseIcon size="xs" />
      </button>
    </div>
  );
}
