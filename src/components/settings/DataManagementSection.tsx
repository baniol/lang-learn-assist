import { useRef } from "react";
import { SettingsSection } from "./SettingsSection";
import { UploadIcon, DownloadIcon } from "../icons";
import type { ImportMode, ImportResult } from "../../types";

interface DataManagementSectionProps {
  importMode: ImportMode;
  isExporting: boolean;
  isImporting: boolean;
  operationResult: {
    type: "success" | "error";
    message: string;
    details?: ImportResult;
  } | null;
  onImportModeChange: (mode: ImportMode) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export function DataManagementSection({
  importMode,
  isExporting,
  isImporting,
  operationResult,
  onImportModeChange,
  onExport,
  onImport,
}: DataManagementSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <SettingsSection title="Data Management">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Export all your data (conversations, phrases, progress, settings) to a
          JSON file for backup or transfer to another device.
        </p>

        {/* Export */}
        <div>
          <button
            onClick={onExport}
            disabled={isExporting}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isExporting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <UploadIcon size="sm" />
            )}
            Export Data
          </button>
        </div>

        {/* Import */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Import Data
          </h3>
          <div className="space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === "merge"}
                  onChange={() => onImportModeChange("merge")}
                  className="w-4 h-4 text-blue-500"
                />
                <div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Merge
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Add new items, update existing if newer
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="overwrite"
                  checked={importMode === "overwrite"}
                  onChange={() => onImportModeChange("overwrite")}
                  className="w-4 h-4 text-blue-500"
                />
                <div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Overwrite
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Replace all data with imported data
                  </p>
                </div>
              </label>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isImporting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-700 dark:border-white" />
              ) : (
                <DownloadIcon size="sm" />
              )}
              Import Data
            </button>
          </div>
        </div>

        {/* Operation Result */}
        {operationResult && (
          <div
            className={`p-3 rounded-lg ${
              operationResult.type === "success"
                ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
            }`}
          >
            <p className="text-sm font-medium">{operationResult.message}</p>
            {operationResult.details && (
              <div className="mt-2 text-xs space-y-1">
                {operationResult.details.stats.settingsImported > 0 && (
                  <p>
                    Settings: {operationResult.details.stats.settingsImported}{" "}
                    imported
                  </p>
                )}
                {operationResult.details.stats.phrasesImported > 0 && (
                  <p>
                    Phrases: {operationResult.details.stats.phrasesImported}{" "}
                    imported
                  </p>
                )}
                {operationResult.details.stats.notesImported > 0 && (
                  <p>
                    Notes: {operationResult.details.stats.notesImported} imported
                  </p>
                )}
                {operationResult.details.stats.questionThreadsImported > 0 && (
                  <p>
                    Question threads:{" "}
                    {operationResult.details.stats.questionThreadsImported}{" "}
                    imported
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 rounded-lg">
          Note: API keys are included in exports. Keep your export files secure.
          Audio files are not exported (only file paths).
        </p>
      </div>
    </SettingsSection>
  );
}
