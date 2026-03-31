import { SettingsSection } from "./SettingsSection";

interface ExerciseSettingsSectionProps {
  repetitionsRequired: number;
  onRepetitionsChange: (value: number) => void;
}

export function ExerciseSettingsSection({
  repetitionsRequired,
  onRepetitionsChange,
}: ExerciseSettingsSectionProps) {
  return (
    <SettingsSection title="Exercise" description="Configure phrase exercise behavior">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Required correct in a row
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={10}
            value={repetitionsRequired}
            onChange={(e) => {
              const val = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
              onRepetitionsChange(val);
            }}
            className="w-20 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          />
          <span className="text-sm text-slate-500 dark:text-slate-400">
            How many times you need to answer correctly in a row to complete a phrase
          </span>
        </div>
      </div>
    </SettingsSection>
  );
}
