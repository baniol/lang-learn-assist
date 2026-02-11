import { SettingsSection } from "./SettingsSection";
import { LANGUAGE_OPTIONS, NATIVE_LANGUAGE_OPTIONS } from "../../types";

const LANGUAGE_FLAGS: Record<string, string> = {
  de: "🇩🇪",
  en: "🇬🇧",
  fr: "🇫🇷",
  es: "🇪🇸",
  it: "🇮🇹",
  pt: "🇵🇹",
  cs: "🇨🇿",
};

interface LanguageSettingsSectionProps {
  targetLanguage: string;
  nativeLanguage: string;
  onTargetLanguageChange: (lang: string) => void;
  onNativeLanguageChange: (lang: string) => void;
}

export function LanguageSettingsSection({
  targetLanguage,
  nativeLanguage,
  onTargetLanguageChange,
  onNativeLanguageChange,
}: LanguageSettingsSectionProps) {
  return (
    <SettingsSection
      title="Active Language"
      description="Your current focus language for learning"
      highlight
      icon={<div className="text-2xl">{LANGUAGE_FLAGS[targetLanguage]}</div>}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Target Language (Learning)
          </label>
          <select
            value={targetLanguage}
            onChange={(e) => onTargetLanguageChange(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Native Language
          </label>
          <select
            value={nativeLanguage}
            onChange={(e) => onNativeLanguageChange(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          >
            {NATIVE_LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-3 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
        New conversations and practice sessions will use these languages. You
        can also quickly switch languages using the dropdown in the sidebar.
      </p>
    </SettingsSection>
  );
}
