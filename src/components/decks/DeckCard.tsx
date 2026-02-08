import { Badge, type BadgeVariant, Button } from "../ui";
import { PlayIcon, ChevronRightIcon } from "../icons";
import type { DeckWithStats } from "../../types";

interface DeckCardProps {
  deck: DeckWithStats;
  onStudy: (deckId: number) => void;
  onView: (deckId: number) => void;
}

/**
 * Get color variant for CEFR level badge
 */
function getLevelVariant(level: string): BadgeVariant {
  const upperLevel = level.toUpperCase();
  if (upperLevel === "A1" || upperLevel === "A2") return "success";
  if (upperLevel === "B1" || upperLevel === "B2") return "warning";
  if (upperLevel === "C1" || upperLevel === "C2") return "error";
  return "default";
}

export function DeckCard({ deck, onStudy, onView }: DeckCardProps) {
  const { deck: deckData, totalPhrases, graduatedCount, learningCount } = deck;
  const progressPercent =
    totalPhrases > 0 ? Math.round((graduatedCount / totalPhrases) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onView(deckData.id)}
              className="font-medium text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left truncate block"
            >
              {deckData.name}
            </button>
            {/* Level Badge */}
            {deckData.level && (
              <Badge
                variant={getLevelVariant(deckData.level)}
                size="sm"
                className="shrink-0"
              >
                {deckData.level.toUpperCase()}
              </Badge>
            )}
          </div>
          {deckData.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {deckData.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant="default" size="sm">
              {totalPhrases} phrases
            </Badge>
            {learningCount > 0 && (
              <Badge variant="warning" size="sm">
                {learningCount} learning
              </Badge>
            )}
            {graduatedCount > 0 && (
              <Badge variant="success" size="sm">
                {graduatedCount} graduated
              </Badge>
            )}
            {deckData.category && (
              <Badge variant="default" size="sm" className="capitalize">
                {deckData.category}
              </Badge>
            )}
          </div>

          {/* Progress Bar */}
          {totalPhrases > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span>Progress</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {learningCount > 0 && (
            <Button
              onClick={() => onStudy(deckData.id)}
              size="sm"
              title="Study deck"
            >
              <PlayIcon size="sm" />
              Study
            </Button>
          )}
          <Button
            onClick={() => onView(deckData.id)}
            variant="ghost"
            size="sm"
            title="View deck"
          >
            <ChevronRightIcon size="sm" />
          </Button>
        </div>
      </div>
    </div>
  );
}
