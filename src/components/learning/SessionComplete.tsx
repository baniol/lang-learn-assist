import { Button } from "../ui";
import { CheckCircleIcon, CalendarIcon } from "../icons";

interface SessionCompleteProps {
  totalPhrases: number;
  correctAnswers: number;
  practicedAny: boolean;
  onEndSession: () => void;
}

export function SessionComplete({
  totalPhrases,
  correctAnswers,
  practicedAny,
  onEndSession,
}: SessionCompleteProps) {
  return (
    <div className="p-6 max-w-2xl mx-auto text-center">
      {practicedAny ? (
        <>
          <CheckCircleIcon size="xl" className="mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
            Session Complete!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            You practiced {totalPhrases} phrases with {correctAnswers} correct
            answers.
          </p>
        </>
      ) : (
        <>
          <CalendarIcon size="xl" className="mx-auto text-blue-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
            All caught up!
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            No phrases are due for review right now. Come back later when your
            SRS intervals expire.
          </p>
        </>
      )}
      <Button onClick={onEndSession}>Back to Dashboard</Button>
    </div>
  );
}
