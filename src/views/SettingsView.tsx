import { useState, useEffect } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { getSettings, saveSettings, testLlmConnection } from "../api";
import { testTtsConnection, getAvailableVoices } from "../lib/tts";
import {
  getAvailableModels,
  getModelStatus,
  downloadModel,
  deleteModel,
} from "../lib/audio";
import { exportToFile, readFileAsJson, importData } from "../lib/dataExport";
import { Button, ConfirmDialog } from "../components/ui";
import { CheckIcon } from "../components/icons";
import {
  LlmSettingsSection,
  LLM_MODELS,
  WhisperSettingsSection,
  TtsSettingsSection,
  LanguageSettingsSection,
  LearningSettingsSection,
  NotesSettingsSection,
  DataManagementSection,
} from "../components/settings";
import type {
  AppSettings,
  WhisperModel,
  TtsVoice,
  ImportMode,
  ImportResult,
} from "../types";

export function SettingsView() {
  const { updateSettings: updateGlobalSettings, refreshSettings } =
    useSettings();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [whisperModels, setWhisperModels] = useState<
    (WhisperModel & { downloaded: boolean })[]
  >([]);
  const [ttsVoices, setTtsVoices] = useState<TtsVoice[]>([]);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [testResults, setTestResults] = useState<{
    llm?: string;
    tts?: string;
  }>({});
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dataOperationResult, setDataOperationResult] = useState<{
    type: "success" | "error";
    message: string;
    details?: ImportResult;
  } | null>(null);

  useEffect(() => {
    loadSettings();
    loadWhisperModels();
  }, []);

  useEffect(() => {
    if (settings?.ttsProvider === "elevenlabs" && settings?.ttsApiKey) {
      loadTtsVoices();
    }
  }, [settings?.ttsProvider, settings?.ttsApiKey]);

  useEffect(() => {
    if (settings && settings.llmProvider !== "none") {
      const models = LLM_MODELS[settings.llmProvider];
      const currentModelValid = models.some((m) => m.id === settings.llmModel);
      if (!currentModelValid && models.length > 0) {
        updateSetting("llmModel", models[0].id);
      }
    }
  }, [settings?.llmProvider]);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWhisperModels = async () => {
    try {
      const models = await getAvailableModels();
      const modelsWithStatus = await Promise.all(
        models.map(async (m) => ({
          ...m,
          downloaded: await getModelStatus(m.fileName),
        }))
      );
      setWhisperModels(modelsWithStatus);
    } catch (err) {
      console.error("Failed to load models:", err);
    }
  };

  const loadTtsVoices = async () => {
    setVoicesLoading(true);
    setVoicesError(null);
    try {
      const voices = await getAvailableVoices();
      setTtsVoices(voices);
      if (voices.length === 0) {
        setVoicesError("No voices found");
      }
    } catch (err) {
      console.error("Failed to load TTS voices:", err);
      setVoicesError(String(err));
    } finally {
      setVoicesLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await saveSettings(settings);
      await updateGlobalSettings(settings);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadModel = async (fileName: string, sizeMb: number) => {
    setDownloadingModel(fileName);
    setDownloadProgress(0);

    const startTime = Date.now();
    const estimatedDurationMs = sizeMb * 200;

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const estimatedProgress = Math.min(
        95,
        (elapsed / estimatedDurationMs) * 100
      );
      setDownloadProgress(estimatedProgress);
    }, 200);

    try {
      await downloadModel(fileName);
      clearInterval(progressInterval);
      setDownloadProgress(100);
      await loadWhisperModels();

      if (settings && !settings.activeWhisperModel) {
        const newSettings = { ...settings, activeWhisperModel: fileName };
        setSettings(newSettings);
        await saveSettings(newSettings);
      }
    } catch (err) {
      console.error("Failed to download model:", err);
      clearInterval(progressInterval);
    } finally {
      setTimeout(() => {
        setDownloadingModel(null);
        setDownloadProgress(0);
      }, 500);
    }
  };

  const handleSelectActiveModel = async (fileName: string) => {
    if (!settings) return;
    const newSettings = { ...settings, activeWhisperModel: fileName };
    setSettings(newSettings);

    try {
      await saveSettings(newSettings);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const confirmDeleteModel = async () => {
    if (!deletingModel) return;
    try {
      await deleteModel(deletingModel);

      if (settings?.activeWhisperModel === deletingModel) {
        const newSettings = { ...settings, activeWhisperModel: "" };
        setSettings(newSettings);
        await saveSettings(newSettings);
      }

      await loadWhisperModels();
    } catch (err) {
      console.error("Failed to delete model:", err);
    } finally {
      setDeletingModel(null);
    }
  };

  const handleTestLlm = async () => {
    setTestResults((prev) => ({ ...prev, llm: "Testing..." }));
    try {
      const result = await testLlmConnection();
      setTestResults((prev) => ({ ...prev, llm: result }));
    } catch (err) {
      setTestResults((prev) => ({ ...prev, llm: `Error: ${err}` }));
    }
  };

  const handleTestTts = async () => {
    setTestResults((prev) => ({ ...prev, tts: "Testing..." }));
    try {
      const result = await testTtsConnection();
      setTestResults((prev) => ({ ...prev, tts: result }));
    } catch (err) {
      setTestResults((prev) => ({ ...prev, tts: `Error: ${err}` }));
    }
  };

  const updateSetting = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const handleExport = async () => {
    setIsExporting(true);
    setDataOperationResult(null);
    try {
      const result = await exportToFile();
      if (result.success) {
        setDataOperationResult({
          type: "success",
          message: "Data exported successfully",
        });
      } else if (result.error !== "Export cancelled") {
        setDataOperationResult({
          type: "error",
          message: result.error || "Export failed",
        });
      }
    } catch (err) {
      setDataOperationResult({
        type: "error",
        message: String(err),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    setIsImporting(true);
    setDataOperationResult(null);
    try {
      const data = await readFileAsJson(file);
      const result = await importData(data, importMode);
      setDataOperationResult({
        type: "success",
        message: result.message,
        details: result,
      });
      loadSettings();
      refreshSettings();
    } catch (err) {
      setDataOperationResult({
        type: "error",
        message: String(err),
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          Settings
        </h1>
        <Button onClick={handleSave} disabled={isSaving} isLoading={isSaving}>
          <CheckIcon size="sm" />
          Save Settings
        </Button>
      </div>

      <div className="space-y-6">
        <LlmSettingsSection
          provider={settings.llmProvider}
          apiKey={settings.llmApiKey}
          model={settings.llmModel}
          testResult={testResults.llm}
          onProviderChange={(p) => updateSetting("llmProvider", p)}
          onApiKeyChange={(k) => updateSetting("llmApiKey", k)}
          onModelChange={(m) => updateSetting("llmModel", m)}
          onTest={handleTestLlm}
        />

        <WhisperSettingsSection
          models={whisperModels}
          activeModel={settings.activeWhisperModel}
          downloadingModel={downloadingModel}
          downloadProgress={downloadProgress}
          onSelectModel={handleSelectActiveModel}
          onDownloadModel={handleDownloadModel}
          onDeleteModel={setDeletingModel}
        />

        <TtsSettingsSection
          provider={settings.ttsProvider}
          apiKey={settings.ttsApiKey}
          voicesPerLanguage={settings.ttsVoicesPerLanguage}
          voices={ttsVoices}
          voicesLoading={voicesLoading}
          voicesError={voicesError}
          testResult={testResults.tts}
          onProviderChange={(p) => updateSetting("ttsProvider", p)}
          onApiKeyChange={(k) => updateSetting("ttsApiKey", k)}
          onVoicesPerLanguageChange={(v) =>
            updateSetting("ttsVoicesPerLanguage", v)
          }
          onRefreshVoices={loadTtsVoices}
          onTest={handleTestTts}
        />

        <LanguageSettingsSection
          targetLanguage={settings.targetLanguage}
          nativeLanguage={settings.nativeLanguage}
          onTargetLanguageChange={(l) => updateSetting("targetLanguage", l)}
          onNativeLanguageChange={(l) => updateSetting("nativeLanguage", l)}
        />

        <LearningSettingsSection
          requiredStreak={settings.requiredStreak}
          failureRepetitions={settings.failureRepetitions}
          sessionPhraseLimit={settings.sessionPhraseLimit}
          newPhrasesPerSession={settings.newPhrasesPerSession}
          defaultExerciseMode={settings.defaultExerciseMode}
          immediateRetry={settings.immediateRetry}
          fuzzyMatching={settings.fuzzyMatching}
          onRequiredStreakChange={(v) => updateSetting("requiredStreak", v)}
          onFailureRepetitionsChange={(v) =>
            updateSetting("failureRepetitions", v)
          }
          onSessionPhraseLimitChange={(v) =>
            updateSetting("sessionPhraseLimit", v)
          }
          onNewPhrasesPerSessionChange={(v) =>
            updateSetting("newPhrasesPerSession", v)
          }
          onDefaultExerciseModeChange={(m) =>
            updateSetting("defaultExerciseMode", m)
          }
          onImmediateRetryChange={(v) => updateSetting("immediateRetry", v)}
          onFuzzyMatchingChange={(v) => updateSetting("fuzzyMatching", v)}
        />

        <NotesSettingsSection
          notesEnabled={settings.notesEnabled}
          onNotesEnabledChange={(v) => updateSetting("notesEnabled", v)}
        />

        <DataManagementSection
          importMode={importMode}
          isExporting={isExporting}
          isImporting={isImporting}
          operationResult={dataOperationResult}
          onImportModeChange={setImportMode}
          onExport={handleExport}
          onImport={handleImport}
        />
      </div>

      <ConfirmDialog
        isOpen={deletingModel !== null}
        onClose={() => setDeletingModel(null)}
        onConfirm={confirmDeleteModel}
        title="Delete Model?"
        message={`Are you sure you want to delete the model "${whisperModels.find((m) => m.fileName === deletingModel)?.name}"? You will need to download it again if you want to use it.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
