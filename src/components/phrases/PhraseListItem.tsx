import { StarIcon } from "../icons";
import { PhraseActions } from "./PhraseActions";
import type { Phrase } from "../../types";

interface PhraseListItemProps {
  item: Phrase;
  isPlaying: boolean;
  isLoading: boolean;
  onToggleStar: (id: number) => void;
  onPlay: () => void;
  onRefine: () => void;
  onTranslate?: () => void;
  onDelete: () => void;
}

export function PhraseListItem({
  item: phrase,
  isPlaying,
  isLoading,
  onToggleStar,
  onPlay,
  onRefine,
  onTranslate,
  onDelete,
}: PhraseListItemProps) {
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

      {/* Actions */}
      <PhraseActions
        phraseId={phrase.id}
        isPlaying={isPlaying}
        isLoading={isLoading}
        isRefined={phrase.refined}
        onPlay={onPlay}
        onRefine={onRefine}
        onTranslate={onTranslate}
        onDelete={onDelete}
      />
    </div>
  );
}
