import { StarIcon } from "../icons";
import { PhraseStatusBadge } from "./PhraseStatusBadge";
import { PhraseActions } from "./PhraseActions";
import type { PhraseWithProgress } from "../../types";

interface PhraseListItemProps {
  item: PhraseWithProgress;
  isPlaying: boolean;
  isLoading: boolean;
  onToggleStar: (id: number) => void;
  onToggleExcluded: (id: number) => void;
  onPlay: () => void;
  onRefine: () => void;
  onDelete: () => void;
  onAssignToDeck?: () => void;
}

export function PhraseListItem({
  item,
  isPlaying,
  isLoading,
  onToggleStar,
  onToggleExcluded,
  onPlay,
  onRefine,
  onDelete,
  onAssignToDeck,
}: PhraseListItemProps) {
  const { phrase, progress } = item;

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
      {/* Star */}
      <button
        onClick={() => onToggleStar(phrase.id)}
        className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex-shrink-0 ${
          phrase.starred
            ? "text-yellow-500"
            : "text-slate-300 dark:text-slate-600"
        }`}
      >
        <StarIcon size="sm" filled={phrase.starred} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
          {phrase.prompt}
        </p>
        <p className="text-base font-medium text-slate-800 dark:text-white">
          {phrase.answer}
        </p>
      </div>

      {/* Status badge */}
      <PhraseStatusBadge progress={progress} />

      {/* Actions */}
      <PhraseActions
        phraseId={phrase.id}
        isExcluded={phrase.excluded}
        isPlaying={isPlaying}
        isLoading={isLoading}
        hasDeck={phrase.deckId !== null}
        onPlay={onPlay}
        onRefine={onRefine}
        onToggleExcluded={() => onToggleExcluded(phrase.id)}
        onDelete={onDelete}
        onAssignToDeck={onAssignToDeck}
      />
    </div>
  );
}
