import { Button } from "../ui";

interface SessionHeaderProps {
  seenCount: number;
  totalLimit: number;
  correctCount: number;
  newCount: number;
  newLimit: number;
  learnedCount: number;
  onEndSession: () => void;
}

export function SessionHeader({
  seenCount,
  totalLimit,
  correctCount,
  newCount,
  newLimit,
  learnedCount,
  onEndSession,
}: SessionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Practiced: {seenCount}
          {totalLimit > 0 && `/${totalLimit}`}
          {" | "}Correct: {correctCount}
          {" | "}New: {newCount}
          {newLimit > 0 && `/${newLimit}`}
          {" | "}Learned: {learnedCount}
        </p>
      </div>
      <Button variant="ghost" onClick={onEndSession}>
        End Session
      </Button>
    </div>
  );
}
