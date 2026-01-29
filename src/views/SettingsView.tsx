import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { testLlmConnection } from "../lib/llm";
import { testTtsConnection, getAvailableVoices } from "../lib/tts";
import { getAvailableModels, getModelStatus, downloadModel, deleteModel } from "../lib/audio";
import type { AppSettings, WhisperModel, TtsVoice, LlmProvider, TtsProvider, ExerciseMode } from "../types";
import { LANGUAGE_OPTIONS, NATIVE_LANGUAGE_OPTIONS } from "../types";

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

export function SettingsView() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [whisperModels, setWhisperModels] = useState<(WhisperModel & { downloaded: boolean })[]>([]);
  const [ttsVoices, setTtsVoices] = useState<TtsVoice[]>([]);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [testResults, setTestResults] = useState<{ llm?: string; tts?: string }>({});
  const [deletingModel, setDeletingModel] = useState<string | null>(null);

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
    try {
      const voices = await getAvailableVoices();
      setTtsVoices(voices);
    } catch (err) {
      console.error("Failed to load TTS voices:", err);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await invoke("save_settings", { settings });
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

                {ttsVoices.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Voice
                    </label>
                    <select
                      value={settings.ttsVoiceId}
                      onChange={(e) => updateSetting("ttsVoiceId", e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                    >
                      <option value="">Select a voice...</option>
                      {ttsVoices.map((voice) => (
                        <option key={voice.voiceId} value={voice.voiceId}>
                          {voice.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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

        {/* Language Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
            Language
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Language (Learning)
              </label>
              <select
                value={settings.targetLanguage}
                onChange={(e) => updateSetting("targetLanguage", e.target.value)}
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
        </section>

        {/* Learning Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
            Learning
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Required Streak to Mark as Learned
              </label>
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

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.immediateRetry}
                onChange={(e) => updateSetting("immediateRetry", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Immediate retry on wrong answer (require 2 correct in a row)
              </span>
            </label>
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
