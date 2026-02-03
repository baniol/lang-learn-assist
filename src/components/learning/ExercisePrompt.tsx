import { ExcludeIcon } from "../icons";

interface ExercisePromptProps {
  prompt: string;
  onExclude: () => void;
}

export function ExercisePrompt({ prompt, onExclude }: ExercisePromptProps) {
  return (
    <div className="text-center mb-8 relative">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
        Translate to German:
      </p>
      <p className="text-2xl font-medium text-slate-800 dark:text-white">
        {prompt}
      </p>
      <button
        onClick={onExclude}
        className="absolute right-0 top-0 p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        title="Exclude from learning"
      >
        <ExcludeIcon size="sm" />
      </button>
    </div>
  );
}
