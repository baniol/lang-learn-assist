import { Button, Badge } from "../ui";
import { ChevronLeftIcon } from "../icons";

interface DeckStudyHeaderProps {
  deckName: string;
  seenCount: number;
  correctCount: number;
  graduatedCount: number;
  graduationThreshold: number;
  onEndSession: () => void;
  onBack: () => void;
}

export function DeckStudyHeader({
  deckName,
  seenCount,
  correctCount,
  graduatedCount,
  graduationThreshold,
  onEndSession,
  onBack,
}: DeckStudyHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeftIcon size="sm" />
          Back
        </Button>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
          {deckName}
        </h2>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="default" size="sm">
            Practiced: {seenCount}
          </Badge>
          <Badge variant="success" size="sm">
            Correct: {correctCount}
          </Badge>
          {graduatedCount > 0 && (
            <Badge variant="info" size="sm">
              Graduated: {graduatedCount}
            </Badge>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500">
            ({graduationThreshold} correct to graduate)
          </span>
        </div>
        <Button variant="ghost" onClick={onEndSession}>
          End Session
        </Button>
      </div>
    </div>
  );
}
