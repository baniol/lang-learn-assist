import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { testLlmConnection } from "../lib/llm";
import { testTtsConnection, getAvailableVoices } from "../lib/tts";
import { getAvailableModels, getModelStatus, downloadModel, deleteModel } from "../lib/audio";
import { exportToFile, readFileAsJson, importData } from "../lib/dataExport";
import { ToggleSwitch } from "../components/ToggleSwitch";
import type { AppSettings, WhisperModel, TtsVoice, LlmProvider, TtsProvider, ExerciseMode, LanguageVoiceSettings, ImportMode, ImportResult } from "../types";
import { LANGUAGE_OPTIONS, NATIVE_LANGUAGE_OPTIONS } from "../types";

// All supported target languages for voice configuration
const VOICE_LANGUAGES = [
  { code: "de", name: "German" },
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
];

const LLM_MODELS = {
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  ],
  none: [],
};

interface SettingsViewProps {
  onSettingsChange?: (settings: AppSettings) => void;
}

export function SettingsView({ onSettingsChange }: SettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [whisperModels, setWhisperModels] = useState<(WhisperModel & { downloaded: boolean })[]>([]);
  const [ttsVoices, setTtsVoices] = useState<TtsVoice[]>([]);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [testResults, setTestResults] = useState<{ llm?: string; tts?: string }>({});
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [selectedVoiceLanguage, setSelectedVoiceLanguage] = useState<string>("de");
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dataOperationResult, setDataOperationResult] = useState<{ type: "success" | "error"; message: string; details?: ImportResult } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
    loadWhisperModels();
  }, []);

  useEffect(() => {
    if (settings?.ttsProvider === "elevenlabs" && settings?.ttsApiKey) {
      loadTtsVoices();
    }
  }, [settings?.ttsProvider, settings?.ttsApiKey]);

  // When provider changes, set a default model for that provider
  useEffect(() => {
    if (settings && settings.llmProvider !== "none") {
      const models = LLM_MODELS[settings.llmProvider];
      const currentModelValid = models.some(m => m.id === settings.llmModel);
      if (!currentModelValid && models.length > 0) {
        updateSetting("llmModel", models[0].id);
      }
    }
  }, [settings?.llmProvider]);

  const loadSettings = async () => {
    try {
      const data = await invoke<AppSettings>("get_settings");
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
      await invoke("save_settings", { settings });
      // Notify parent of settings change
      onSettingsChange?.(settings);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadModel = async (fileName: string, sizeMb: number) => {
    setDownloadingModel(fileName);
    setDownloadProgress(0);

    // Simulate progress updates since the actual download doesn't provide progress
    const startTime = Date.now();
    const estimatedDurationMs = sizeMb * 200; // Rough estimate: 200ms per MB

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const estimatedProgress = Math.min(95, (elapsed / estimatedDurationMs) * 100);
      setDownloadProgress(estimatedProgress);
    }, 200);

    try {
      await downloadModel(fileName);
      clearInterval(progressInterval);
      setDownloadProgress(100);
      await loadWhisperModels();

      // Auto-select as active if no model is currently active
      if (settings && !settings.activeWhisperModel) {
        const newSettings = { ...settings, activeWhisperModel: fileName };
        setSettings(newSettings);
        await invoke("save_settings", { settings: newSettings });
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

    // Auto-save when selecting active model
    try {
      await invoke("save_settings", { settings: newSettings });
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const handleDeleteModel = (fileName: string) => {
    setDeletingModel(fileName);
  };

  const confirmDeleteModel = async () => {
    if (!deletingModel) return;
    try {
      await deleteModel(deletingModel);

      // If deleting the active model, clear the setting and save
      if (settings?.activeWhisperModel === deletingModel) {
        const newSettings = { ...settings, activeWhisperModel: "" };
        setSettings(newSettings);
        await invoke("save_settings", { settings: newSettings });
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

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      // Reload settings after import
      loadSettings();
    } catch (err) {
      setDataOperationResult({
        type: "error",
        message: String(err),
      });
    } finally {
      setIsImporting(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const availableModels = LLM_MODELS[settings.llmProvider] || [];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {isSaving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          Save Settings
        </button>
      </div>

      <div className="space-y-6">
        {/* LLM Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
            LLM Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Provider
              </label>
              <select
                value={settings.llmProvider}
                onChange={(e) => updateSetting("llmProvider", e.target.value as LlmProvider)}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="none">None</option>
              </select>
            </div>

            {settings.llmProvider !== "none" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={settings.llmApiKey}
                    onChange={(e) => updateSetting("llmApiKey", e.target.value)}
                    placeholder="Enter your API key..."
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Model
                  </label>
                  <select
                    value={settings.llmModel}
                    onChange={(e) => updateSetting("llmModel", e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  >
                    {availableModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleTestLlm}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Test Connection
                  </button>
                  {testResults.llm && (
                    <p className={`text-sm ${testResults.llm.startsWith("Error") ? "text-red-500" : "text-green-500"}`}>
                      {testResults.llm}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Whisper Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
            Voice Recognition (Whisper)
          </h2>
          <div className="space-y-2">
            {whisperModels.map((model) => {
              const isActive = settings.activeWhisperModel === model.fileName;
              return (
                <div
                  key={model.fileName}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border-2 transition-colors
                    ${isActive && model.downloaded
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-transparent bg-slate-50 dark:bg-slate-900"
                    }
                  `}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* Radio button for selection - only clickable if downloaded */}
                    <button
                      type="button"
                      onClick={() => model.downloaded && handleSelectActiveModel(model.fileName)}
                      disabled={!model.downloaded}
                      className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                        ${model.downloaded
                          ? isActive
                            ? "border-blue-500 bg-blue-500"
                            : "border-slate-300 dark:border-slate-600 hover:border-blue-400"
                          : "border-slate-200 dark:border-slate-700 cursor-not-allowed"
                        }
                      `}
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
                        onClick={() => handleDeleteModel(model.fileName)}
                        title="Delete model"
                        className="p-1.5 rounded transition-colors text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDownloadModel(model.fileName, model.sizeMb)}
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

            {whisperModels.filter((m) => m.downloaded).length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
                Download a model to enable voice recognition
              </p>
            )}
          </div>
        </section>

        {/* TTS Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
            Text-to-Speech
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Provider
              </label>
              <select
                value={settings.ttsProvider}
                onChange={(e) => updateSetting("ttsProvider", e.target.value as TtsProvider)}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              >
                <option value="none">None</option>
                <option value="elevenlabs">ElevenLabs</option>
              </select>
            </div>

            {settings.ttsProvider !== "none" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={settings.ttsApiKey}
                    onChange={(e) => updateSetting("ttsApiKey", e.target.value)}
                    placeholder="Enter your API key..."
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Per-Language Voice Settings
                    </label>
                    <button
                      onClick={loadTtsVoices}
                      disabled={voicesLoading}
                      className="text-xs text-blue-500 hover:text-blue-600 disabled:opacity-50"
                    >
                      {voicesLoading ? "Loading..." : "Refresh voices"}
                    </button>
                  </div>
                  {voicesError && (
                    <p className="text-sm text-red-500 mb-2">{voicesError}</p>
                  )}
                  {voicesLoading ? (
                    <div className="flex items-center gap-2 py-2 text-slate-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                      <span className="text-sm">Loading voices...</span>
                    </div>
                  ) : ttsVoices.length > 0 ? (
                    <div className="space-y-4">
                      {/* Language tabs */}
                      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700 pb-2">
                        {VOICE_LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => setSelectedVoiceLanguage(lang.code)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors ${
                              selectedVoiceLanguage === lang.code
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-b-2 border-blue-500"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`}
                          >
                            {lang.name}
                            {settings.ttsVoicesPerLanguage[lang.code]?.default && (
                              <span className="ml-1 w-2 h-2 inline-block bg-green-500 rounded-full" title="Configured" />
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Voice settings for selected language */}
                      <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {VOICE_LANGUAGES.find(l => l.code === selectedVoiceLanguage)?.name} Voices
                        </h4>

                        {/* Default Voice */}
                        <div>
                          <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                            Default Voice (Practice)
                          </label>
                          <select
                            value={settings.ttsVoicesPerLanguage[selectedVoiceLanguage]?.default || ""}
                            onChange={(e) => {
                              const current = settings.ttsVoicesPerLanguage[selectedVoiceLanguage] || { default: "", voiceA: "", voiceB: "" };
                              const updated: LanguageVoiceSettings = { ...current, default: e.target.value };
                              updateSetting("ttsVoicesPerLanguage", {
                                ...settings.ttsVoicesPerLanguage,
                                [selectedVoiceLanguage]: updated,
                              });
                            }}
                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                          >
                            <option value="">Select a voice...</option>
                            {ttsVoices.map((voice) => (
                              <option key={voice.voiceId} value={voice.voiceId}>
                                {voice.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Conversation Voices */}
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            Conversation Voices (alternating)
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                                Voice A
                              </label>
                              <select
                                value={settings.ttsVoicesPerLanguage[selectedVoiceLanguage]?.voiceA || ""}
                                onChange={(e) => {
                                  const current = settings.ttsVoicesPerLanguage[selectedVoiceLanguage] || { default: "", voiceA: "", voiceB: "" };
                                  const updated: LanguageVoiceSettings = { ...current, voiceA: e.target.value };
                                  updateSetting("ttsVoicesPerLanguage", {
                                    ...settings.ttsVoicesPerLanguage,
                                    [selectedVoiceLanguage]: updated,
                                  });
                                }}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm"
                              >
                                <option value="">Use default</option>
                                {ttsVoices.map((voice) => (
                                  <option key={voice.voiceId} value={voice.voiceId}>
                                    {voice.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 dark:text-slate-500 mb-1">
                                Voice B
                              </label>
                              <select
                                value={settings.ttsVoicesPerLanguage[selectedVoiceLanguage]?.voiceB || ""}
                                onChange={(e) => {
                                  const current = settings.ttsVoicesPerLanguage[selectedVoiceLanguage] || { default: "", voiceA: "", voiceB: "" };
                                  const updated: LanguageVoiceSettings = { ...current, voiceB: e.target.value };
                                  updateSetting("ttsVoicesPerLanguage", {
                                    ...settings.ttsVoicesPerLanguage,
                                    [selectedVoiceLanguage]: updated,
                                  });
                                }}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm"
                              >
                                <option value="">Use default</option>
                                {ttsVoices.map((voice) => (
                                  <option key={voice.voiceId} value={voice.voiceId}>
                                    {voice.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Alternate between Voice A and Voice B when playing conversation messages
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                      Save settings first, then click "Refresh voices"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleTestTts}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Test Connection
                  </button>
                  {testResults.tts && (
                    <p className={`text-sm ${testResults.tts.startsWith("Error") ? "text-red-500" : "text-green-500"}`}>
                      {testResults.tts}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Active Language Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border-2 border-blue-200 dark:border-blue-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl">
              {settings.targetLanguage === "de" && "🇩🇪"}
              {settings.targetLanguage === "en" && "🇬🇧"}
              {settings.targetLanguage === "fr" && "🇫🇷"}
              {settings.targetLanguage === "es" && "🇪🇸"}
              {settings.targetLanguage === "it" && "🇮🇹"}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Active Language
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Your current focus language for learning
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Language (Learning)
              </label>
              <select
                value={settings.targetLanguage}
                onChange={(e) => {
                  updateSetting("targetLanguage", e.target.value);
                  // Auto-select TTS voice tab for new language
                  setSelectedVoiceLanguage(e.target.value);
                }}
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
                value={settings.nativeLanguage}
                onChange={(e) => updateSetting("nativeLanguage", e.target.value)}
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
            New conversations and practice sessions will use these languages. You can also quickly switch languages using the dropdown in the sidebar.
          </p>
        </section>

        {/* Learning Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
            Learning
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Correct answers to mark as learned
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Answer a phrase correctly this many times in ONE session to mark it as learned
              </p>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.requiredStreak}
                onChange={(e) => updateSetting("requiredStreak", parseInt(e.target.value) || 2)}
                className="w-32 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Required repetitions after failure (speaking mode)
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                After a wrong answer in speaking mode, repeat correctly this many times to continue
              </p>
              <input
                type="number"
                min={1}
                max={5}
                value={settings.failureRepetitions}
                onChange={(e) => updateSetting("failureRepetitions", parseInt(e.target.value) || 2)}
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
                value={settings.sessionPhraseLimit}
                onChange={(e) => updateSetting("sessionPhraseLimit", parseInt(e.target.value) || 20)}
                className="w-32 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                New phrases per session
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                Maximum new phrases to introduce in one session. Master existing phrases before adding more. (0 = unlimited)
              </p>
              <input
                type="number"
                min={0}
                max={20}
                value={settings.newPhrasesPerSession}
                onChange={(e) => updateSetting("newPhrasesPerSession", parseInt(e.target.value) || 2)}
                className="w-32 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Default Exercise Mode
              </label>
              <select
                value={settings.defaultExerciseMode}
                onChange={(e) => updateSetting("defaultExerciseMode", e.target.value as ExerciseMode)}
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
              <ToggleSwitch
                checked={settings.immediateRetry}
                onChange={(checked) => updateSetting("immediateRetry", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Fuzzy matching (accept small transcription errors like "Parkpläzze" for "Parkplätze")
              </span>
              <ToggleSwitch
                checked={settings.fuzzyMatching}
                onChange={(checked) => updateSetting("fuzzyMatching", checked)}
              />
            </div>
          </div>
        </section>

        {/* Notes Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
            Notes
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Enable Notes feature
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Add quick notes and reminders accessible from the sidebar
                </p>
              </div>
              <ToggleSwitch
                checked={settings.notesEnabled}
                onChange={(checked) => updateSetting("notesEnabled", checked)}
              />
            </div>
          </div>
        </section>

        {/* Data Management */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
            Data Management
          </h2>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Export all your data (conversations, phrases, progress, settings) to a JSON file for backup or transfer to another device.
            </p>

            {/* Export */}
            <div>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isExporting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
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
                      onChange={() => setImportMode("merge")}
                      className="w-4 h-4 text-blue-500"
                    />
                    <div>
                      <span className="text-sm text-slate-700 dark:text-slate-300">Merge</span>
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
                      onChange={() => setImportMode("overwrite")}
                      className="w-4 h-4 text-blue-500"
                    />
                    <div>
                      <span className="text-sm text-slate-700 dark:text-slate-300">Overwrite</span>
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
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isImporting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-700 dark:border-white" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  Import Data
                </button>
              </div>
            </div>

            {/* Operation Result */}
            {dataOperationResult && (
              <div
                className={`p-3 rounded-lg ${
                  dataOperationResult.type === "success"
                    ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                }`}
              >
                <p className="text-sm font-medium">{dataOperationResult.message}</p>
                {dataOperationResult.details && (
                  <div className="mt-2 text-xs space-y-1">
                    {dataOperationResult.details.stats.settingsImported > 0 && (
                      <p>Settings: {dataOperationResult.details.stats.settingsImported} imported</p>
                    )}
                    {(dataOperationResult.details.stats.conversationsImported > 0 ||
                      dataOperationResult.details.stats.conversationsUpdated > 0) && (
                      <p>
                        Conversations: {dataOperationResult.details.stats.conversationsImported} imported
                        {dataOperationResult.details.stats.conversationsUpdated > 0 &&
                          `, ${dataOperationResult.details.stats.conversationsUpdated} updated`}
                      </p>
                    )}
                    {dataOperationResult.details.stats.phrasesImported > 0 && (
                      <p>Phrases: {dataOperationResult.details.stats.phrasesImported} imported</p>
                    )}
                    {dataOperationResult.details.stats.phraseProgressImported > 0 && (
                      <p>Progress: {dataOperationResult.details.stats.phraseProgressImported} imported</p>
                    )}
                    {dataOperationResult.details.stats.notesImported > 0 && (
                      <p>Notes: {dataOperationResult.details.stats.notesImported} imported</p>
                    )}
                    {dataOperationResult.details.stats.questionThreadsImported > 0 && (
                      <p>Question threads: {dataOperationResult.details.stats.questionThreadsImported} imported</p>
                    )}
                    {dataOperationResult.details.stats.practiceSessionsImported > 0 && (
                      <p>Practice sessions: {dataOperationResult.details.stats.practiceSessionsImported} imported</p>
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
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Delete Model?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to delete the model "{whisperModels.find(m => m.fileName === deletingModel)?.name}"?
              You will need to download it again if you want to use it.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingModel(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteModel}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
