import { useState } from "react";
import { SettingsSection } from "./SettingsSection";
import { ConfirmDialog } from "../ui";
import { LANGUAGE_OPTIONS, NATIVE_LANGUAGE_OPTIONS } from "../../types";
import type { CustomLanguage } from "../../types";
import { ELEVENLABS_LANGUAGES } from "../../lib/tts";

const LANGUAGE_FLAGS: Record<string, string> = {
  ar: "🇸🇦",
  bg: "🇧🇬",
  zh: "🇨🇳",
  hr: "🇭🇷",
  cs: "🇨🇿",
  da: "🇩🇰",
  nl: "🇳🇱",
  en: "🇬🇧",
  fil: "🇵🇭",
  fi: "🇫🇮",
  fr: "🇫🇷",
  de: "🇩🇪",
  el: "🇬🇷",
  hi: "🇮🇳",
  id: "🇮🇩",
  it: "🇮🇹",
  ja: "🇯🇵",
  ko: "🇰🇷",
  ms: "🇲🇾",
  pl: "🇵🇱",
  pt: "🇵🇹",
  ro: "🇷🇴",
  ru: "🇷🇺",
  sk: "🇸🇰",
  es: "🇪🇸",
  sv: "🇸🇪",
  ta: "🇱🇰",
  tr: "🇹🇷",
  uk: "🇺🇦",
};

interface LanguageSettingsSectionProps {
  targetLanguage: string;
  nativeLanguage: string;
  customLanguages: CustomLanguage[];
  hiddenLanguages: string[];
  onTargetLanguageChange: (lang: string) => void;
  onNativeLanguageChange: (lang: string) => void;
  onCustomLanguagesChange: (langs: CustomLanguage[]) => void;
  onDeleteLanguage: (code: string, name: string) => Promise<void>;
}

export function LanguageSettingsSection({
  targetLanguage,
  nativeLanguage,
  customLanguages,
  hiddenLanguages,
  onTargetLanguageChange,
  onNativeLanguageChange,
  onCustomLanguagesChange,
  onDeleteLanguage,
}: LanguageSettingsSectionProps) {
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ code: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedElevenLabsLang, setSelectedElevenLabsLang] = useState("");

  const hidden = new Set(hiddenLanguages);
  const allTargetOptions = [...LANGUAGE_OPTIONS, ...customLanguages].filter(
    (l) => !hidden.has(l.code)
  );
  const allNativeOptions = [...NATIVE_LANGUAGE_OPTIONS, ...customLanguages].filter(
    (l) => !hidden.has(l.code)
  );

  const handleAddLanguage = () => {
    if (!selectedElevenLabsLang) {
      setAddError("Select a language");
      return;
    }
    const found = ELEVENLABS_LANGUAGES.find((l) => l.languageId === selectedElevenLabsLang);
    if (!found) return;
    if (allTargetOptions.some((l) => l.code === found.languageId)) {
      setAddError(`Language "${found.name}" already exists`);
      return;
    }
    onCustomLanguagesChange([...customLanguages, { code: found.languageId, name: found.name }]);
    setSelectedElevenLabsLang("");
    setAddError(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteLanguage(pendingDelete.code, pendingDelete.name);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const phrasesWarning =
    "All phrases in this language will be permanently deleted. This cannot be undone.";

  return (
    <SettingsSection
      title="Active Language"
      description="Your current focus language for learning"
      highlight
      icon={<div className="text-2xl">{LANGUAGE_FLAGS[targetLanguage] ?? "🌐"}</div>}
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
            {allTargetOptions.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {LANGUAGE_FLAGS[lang.code] ?? "🌐"} {lang.name}
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
            {allNativeOptions.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {LANGUAGE_FLAGS[lang.code] ?? "🌐"} {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-3 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
        New conversations and practice sessions will use these languages. You can also quickly
        switch languages using the dropdown in the sidebar.
      </p>

      {/* Language list with delete buttons */}
      <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          All Languages
        </h4>
        <div className="space-y-1">
          {allTargetOptions.map((lang) => (
            <div
              key={lang.code}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
            >
              <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="text-base">{LANGUAGE_FLAGS[lang.code] ?? "🌐"}</span>
                {lang.name}
                <span className="text-xs text-slate-400 dark:text-slate-500">({lang.code})</span>
              </span>
              <button
                onClick={() => setPendingDelete({ code: lang.code, name: lang.name })}
                className="text-xs text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                title="Delete language and all its phrases"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add custom language */}
      <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Add Custom Language
        </h4>
        <div className="flex gap-2 items-start">
          <select
            value={selectedElevenLabsLang}
            onChange={(e) => {
              setSelectedElevenLabsLang(e.target.value);
              setAddError(null);
            }}
            className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm"
          >
            <option value="">Select language…</option>
            {ELEVENLABS_LANGUAGES.filter(
              (l) => !allTargetOptions.some((existing) => existing.code === l.languageId)
            ).map((l) => (
              <option key={l.languageId} value={l.languageId}>
                {LANGUAGE_FLAGS[l.languageId] ?? "🌐"} {l.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddLanguage}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Add
          </button>
        </div>
        {addError && <p className="mt-1 text-xs text-red-500">{addError}</p>}
      </div>

      {deleteError && <p className="mt-2 text-sm text-red-500">{deleteError}</p>}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        title={`Delete "${pendingDelete?.name}"?`}
        message={phrasesWarning}
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        variant="danger"
      />
    </SettingsSection>
  );
}
