import { cn } from "../../lib/utils";
import type { ExerciseMode } from "../../types";

interface ModeSelectorProps {
  mode: ExerciseMode;
  onModeChange: (mode: ExerciseMode) => void;
}

const EXERCISE_MODES = [
  {
    id: "manual" as const,
    label: "Manual",
    desc: "Reveal answer and self-grade",
  },
  {
    id: "typing" as const,
    label: "Typing",
    desc: "Type the answer in German",
  },
  {
    id: "speaking" as const,
    label: "Speaking",
    desc: "Speak the answer (requires Whisper model)",
  },
];

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
        Exercise Mode
      </h2>
      <div className="space-y-3">
        {EXERCISE_MODES.map((option) => (
          <button
            key={option.id}
            onClick={() => onModeChange(option.id)}
            className={cn(
              "w-full p-4 rounded-lg border-2 text-left transition-all",
              mode === option.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            )}
          >
            <p className="font-medium text-slate-800 dark:text-white">
              {option.label}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {option.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
