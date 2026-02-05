import { SettingsSection } from "./SettingsSection";
import { ToggleSwitch } from "../ToggleSwitch";
import type { ExerciseMode } from "../../types";

interface LearningSettingsSectionProps {
  requiredStreak: number;
  failureRepetitions: number;
  sessionPhraseLimit: number;
  newPhrasesPerSession: number;
  newPhraseInterval: number;
  defaultExerciseMode: ExerciseMode;
  immediateRetry: boolean;
  fuzzyMatching: boolean;
  onRequiredStreakChange: (value: number) => void;
  onFailureRepetitionsChange: (value: number) => void;
  onSessionPhraseLimitChange: (value: number) => void;
  onNewPhrasesPerSessionChange: (value: number) => void;
  onNewPhraseIntervalChange: (value: number) => void;
  onDefaultExerciseModeChange: (mode: ExerciseMode) => void;
  onImmediateRetryChange: (value: boolean) => void;
  onFuzzyMatchingChange: (value: boolean) => void;
}

export function LearningSettingsSection({
  requiredStreak,
  failureRepetitions,
  sessionPhraseLimit,
  newPhrasesPerSession,
  newPhraseInterval,
  defaultExerciseMode,
  immediateRetry,
  fuzzyMatching,
  onRequiredStreakChange,
  onFailureRepetitionsChange,
  onSessionPhraseLimitChange,
  onNewPhrasesPerSessionChange,
  onNewPhraseIntervalChange,
  onDefaultExerciseModeChange,
  onImmediateRetryChange,
  onFuzzyMatchingChange,
}: LearningSettingsSectionProps) {
  return (
    <SettingsSection title="Learning">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Correct answers to mark as learned
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Answer a phrase correctly this many times in ONE session to mark it
            as learned
          </p>
          <input
            type="number"
            min={1}
            max={10}
            value={requiredStreak}
            onChange={(e) =>
              onRequiredStreakChange(parseInt(e.target.value) || 2)
            }
            className="w-32 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Required repetitions after failure (speaking mode)
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            After a wrong answer in speaking mode, repeat correctly this many
            times to continue
          </p>
          <input
            type="number"
            min={1}
            max={5}
            value={failureRepetitions}
            onChange={(e) =>
              onFailureRepetitionsChange(parseInt(e.target.value) || 2)
            }
            className="w-32 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Phrases per session
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Maximum number of phrases to practice in one session (0 = unlimited)
          </p>
          <input
            type="number"
            min={0}
            max={100}
            value={sessionPhraseLimit}
            onChange={(e) =>
              onSessionPhraseLimitChange(parseInt(e.target.value) || 20)
            }
            className="w-32 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            New phrases per session
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Maximum new phrases to introduce in one session. Master existing
            phrases before adding more. (0 = unlimited)
          </p>
          <input
            type="number"
            min={0}
            max={20}
            value={newPhrasesPerSession}
            onChange={(e) =>
              onNewPhrasesPerSessionChange(parseInt(e.target.value) || 2)
            }
            className="w-32 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            New phrase interval
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Introduce a new phrase every N phrases (e.g., 4 = every 4th phrase is
            new). Prevents reviews from blocking new material. (0 = disabled)
          </p>
          <input
            type="number"
            min={0}
            max={20}
            value={newPhraseInterval}
            onChange={(e) =>
              onNewPhraseIntervalChange(parseInt(e.target.value) || 4)
            }
            className="w-32 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Default Exercise Mode
          </label>
          <select
            value={defaultExerciseMode}
            onChange={(e) =>
              onDefaultExerciseModeChange(e.target.value as ExerciseMode)
            }
            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          >
            <option value="manual">Manual (Self-grading)</option>
            <option value="typing">Typing</option>
            <option value="speaking">Speaking</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Immediate retry on wrong answer (require 2 correct in a row)
          </span>
          <ToggleSwitch checked={immediateRetry} onChange={onImmediateRetryChange} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Fuzzy matching (accept small transcription errors like "Parkpläzze"
            for "Parkplätze")
          </span>
          <ToggleSwitch checked={fuzzyMatching} onChange={onFuzzyMatchingChange} />
        </div>
      </div>
    </SettingsSection>
  );
}
