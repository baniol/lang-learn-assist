import { Button } from "../ui";

interface TypingExerciseProps {
  inputAnswer: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

export function TypingExercise({
  inputAnswer,
  onInputChange,
  onSubmit,
}: TypingExerciseProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      <input
        type="text"
        value={inputAnswer}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="Type your answer in German..."
        autoFocus
        className="w-full px-4 py-4 text-lg border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white text-center"
      />
      <Button
        type="submit"
        disabled={!inputAnswer.trim()}
        className="w-full py-4"
      >
        Check Answer
      </Button>
    </form>
  );
}
