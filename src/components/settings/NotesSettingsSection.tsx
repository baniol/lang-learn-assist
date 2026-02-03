import { SettingsSection } from "./SettingsSection";
import { ToggleSwitch } from "../ToggleSwitch";

interface NotesSettingsSectionProps {
  notesEnabled: boolean;
  onNotesEnabledChange: (enabled: boolean) => void;
}

export function NotesSettingsSection({
  notesEnabled,
  onNotesEnabledChange,
}: NotesSettingsSectionProps) {
  return (
    <SettingsSection title="Notes">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Enable Notes feature
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Add quick notes and reminders accessible from the sidebar
          </p>
        </div>
        <ToggleSwitch checked={notesEnabled} onChange={onNotesEnabledChange} />
      </div>
    </SettingsSection>
  );
}
