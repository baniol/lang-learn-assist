import { Badge, Button } from "../ui";
import { TrashIcon, CheckCircleIcon } from "../icons";
import type { PhraseWithProgress } from "../../types";

interface DeckPhraseListProps {
  phrases: PhraseWithProgress[];
  graduationThreshold: number;
  onRemovePhrase: (phraseId: number) => void;
  isRemoving?: boolean;
}

export function DeckPhraseList({
  phrases,
  graduationThreshold,
  onRemovePhrase,
  isRemoving = false,
}: DeckPhraseListProps) {
  if (phrases.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        No phrases in this deck yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-700">
      {phrases.map((item) => {
        const { phrase, progress } = item;
        const deckCorrectCount = progress?.deckCorrectCount ?? 0;
        const isGraduated = progress?.learningStatus === "srs_active";
        const progressPercent = Math.min(
          100,
          Math.round((deckCorrectCount / graduationThreshold) * 100)
        );

        return (
          <div
            key={phrase.id}
            className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
          >
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {phrase.prompt}
              </p>
              <p className="text-base font-medium text-slate-800 dark:text-white">
                {phrase.answer}
              </p>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {isGraduated ? (
                <Badge variant="success" size="sm" className="flex items-center gap-1">
                  <CheckCircleIcon size="xs" />
                  Graduated
                </Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-12 text-right">
                    {deckCorrectCount}/{graduationThreshold}
                  </span>
                </div>
              )}
            </div>

            {/* Remove button */}
            <Button
              onClick={() => onRemovePhrase(phrase.id)}
              variant="ghost"
              size="sm"
              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove from deck"
              disabled={isRemoving}
            >
              <TrashIcon size="sm" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
