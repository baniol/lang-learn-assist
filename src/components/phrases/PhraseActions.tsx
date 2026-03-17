import { cn } from "../../lib/utils";
import { Spinner } from "../ui";
import {
  PlayIcon,
  PauseIcon,
  LightbulbIcon,
  CloseIcon,
} from "../icons";

interface PhraseActionsProps {
  phraseId: number;
  isPlaying: boolean;
  isLoading: boolean;
  isRefined?: boolean;
  onPlay: () => void;
  onRefine: () => void;
  onDelete: () => void;
}

export function PhraseActions({
  isPlaying,
  isLoading,
  isRefined,
  onPlay,
  onRefine,
  onDelete,
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
        className={cn(
          "p-2 rounded transition-colors",
          isRefined
            ? "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50"
            : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
        )}
        title={isRefined ? "Refined - click to edit again" : "Refine with AI"}
      >
        <LightbulbIcon size="xs" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-2 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        title="Delete"
      >
        <CloseIcon size="xs" />
      </button>
    </div>
  );
}
