import { cn } from "../../lib/utils";
import { SettingsSection } from "./SettingsSection";
import { TrashIcon } from "../icons";
import type { WhisperModel } from "../../types";

interface WhisperModelWithStatus extends WhisperModel {
  downloaded: boolean;
}

interface WhisperSettingsSectionProps {
  models: WhisperModelWithStatus[];
  activeModel: string;
  downloadingModel: string | null;
  downloadProgress: number;
  onSelectModel: (fileName: string) => void;
  onDownloadModel: (fileName: string, sizeMb: number) => void;
  onDeleteModel: (fileName: string) => void;
}

export function WhisperSettingsSection({
  models,
  activeModel,
  downloadingModel,
  downloadProgress,
  onSelectModel,
  onDownloadModel,
  onDeleteModel,
}: WhisperSettingsSectionProps) {
  return (
    <SettingsSection title="Voice Recognition (Whisper)">
      <div className="space-y-2">
        {models.map((model) => {
          const isActive = activeModel === model.fileName;
          return (
            <div
              key={model.fileName}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border-2 transition-colors",
                isActive && model.downloaded
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-transparent bg-slate-50 dark:bg-slate-900"
              )}
            >
              <div className="flex items-center gap-3 flex-1">
                <button
                  type="button"
                  onClick={() => model.downloaded && onSelectModel(model.fileName)}
                  disabled={!model.downloaded}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                    model.downloaded
                      ? isActive
                        ? "border-blue-500 bg-blue-500"
                        : "border-slate-300 dark:border-slate-600 hover:border-blue-400"
                      : "border-slate-200 dark:border-slate-700 cursor-not-allowed"
                  )}
                >
                  {isActive && model.downloaded && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800 dark:text-white">{model.name}</p>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      ({model.sizeMb} MB)
                    </span>
                    {isActive && model.downloaded && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  {downloadingModel === model.fileName && (
                    <div className="mt-2">
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Downloading... {Math.round(downloadProgress)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {model.downloaded ? (
                  <button
                    onClick={() => onDeleteModel(model.fileName)}
                    title="Delete model"
                    className="p-1.5 rounded transition-colors text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    <TrashIcon size="sm" />
                  </button>
                ) : (
                  <button
                    onClick={() => onDownloadModel(model.fileName, model.sizeMb)}
                    disabled={downloadingModel !== null}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm font-medium transition-colors"
                  >
                    {downloadingModel === model.fileName ? "Downloading..." : "Download"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {models.filter((m) => m.downloaded).length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
            Download a model to enable voice recognition
          </p>
        )}
      </div>
    </SettingsSection>
  );
}
