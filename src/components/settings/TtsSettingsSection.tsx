import { useState, useRef } from "react";
import { cn } from "../../lib/utils";
import { SettingsSection } from "./SettingsSection";
import { generateTts, getAudioBase64 } from "../../lib/tts";
import type { TtsProvider, TtsVoice, LanguageVoiceSettings } from "../../types";

const TEST_PHRASES: Record<string, string> = {
  ar: "مرحباً، كيف حالك اليوم؟",
  bg: "Здравейте, как сте днес?",
  zh: "你好，你今天怎么样？",
  hr: "Bok, kako ste danas?",
  cs: "Dobrý den, jak se dnes máte?",
  da: "Hej, hvordan har du det i dag?",
  nl: "Hallo, hoe gaat het vandaag met u?",
  en: "Hello, how are you today?",
  fil: "Kumusta ka ngayon?",
  fi: "Hei, mitä sinulle kuuluu tänään?",
  fr: "Bonjour, comment allez-vous aujourd'hui?",
  de: "Hallo, wie geht es Ihnen heute?",
  el: "Γεια σας, πώς είστε σήμερα;",
  hi: "नमस्ते, आज आप कैसे हैं?",
  id: "Halo, apa kabar hari ini?",
  it: "Ciao, come sta oggi?",
  ja: "こんにちは、今日はお元気ですか？",
  ko: "안녕하세요, 오늘 어떠세요?",
  ms: "Helo, apa khabar hari ini?",
  pl: "Cześć, jak się dziś masz?",
  pt: "Olá, como está você hoje?",
  ro: "Bună ziua, cum vă simțiți astăzi?",
  ru: "Здравствуйте, как вы сегодня?",
  sk: "Dobrý deň, ako sa dnes máte?",
  es: "Hola, ¿cómo está usted hoy?",
  sv: "Hej, hur mår du idag?",
  ta: "வணக்கம், இன்று நீங்கள் எப்படி இருக்கிறீர்கள்?",
  tr: "Merhaba, bugün nasılsınız?",
  uk: "Привіт, як ви сьогодні?",
};

interface TtsSettingsSectionProps {
  provider: TtsProvider;
  apiKey: string;
  voicesPerLanguage: Record<string, LanguageVoiceSettings>;
  voices: TtsVoice[];
  voicesLoading: boolean;
  voicesError: string | null;
  testResult?: string;
  allLanguages: Array<{ code: string; name: string }>;
  onProviderChange: (provider: TtsProvider) => void;
  onApiKeyChange: (key: string) => void;
  onVoicesPerLanguageChange: (voices: Record<string, LanguageVoiceSettings>) => void;
  onRefreshVoices: () => void;
  onTest: () => void;
}

export function TtsSettingsSection({
  provider,
  apiKey,
  voicesPerLanguage,
  voices,
  voicesLoading,
  voicesError,
  testResult,
  allLanguages,
  onProviderChange,
  onApiKeyChange,
  onVoicesPerLanguageChange,
  onRefreshVoices,
  onTest,
}: TtsSettingsSectionProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("de");
  const [previewLoading, setPreviewLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const updateLanguageVoice = (langCode: string, value: string) => {
    const updated: LanguageVoiceSettings = { default: value };
    onVoicesPerLanguageChange({ ...voicesPerLanguage, [langCode]: updated });
  };

  const playVoicePreview = async (voiceId: string, langCode: string) => {
    const phrase = TEST_PHRASES[langCode] ?? TEST_PHRASES["en"];
    setPreviewLoading(true);
    try {
      const audioPath = await generateTts(phrase, undefined, voiceId, langCode, true);
      const audioUrl = await getAudioBase64(audioPath);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(audioUrl);
      audioRef.current.play();
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <SettingsSection title="Text-to-Speech">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Provider
          </label>
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as TtsProvider)}
            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          >
            <option value="none">None</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>
        </div>

        {provider !== "none" && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
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
                  onClick={onRefreshVoices}
                  disabled={voicesLoading}
                  className="text-xs text-blue-500 hover:text-blue-600 disabled:opacity-50"
                >
                  {voicesLoading ? "Loading..." : "Refresh voices"}
                </button>
              </div>

              {voicesError && <p className="text-sm text-red-500 mb-2">{voicesError}</p>}

              {voicesLoading ? (
                <div className="flex items-center gap-2 py-2 text-slate-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                  <span className="text-sm">Loading voices...</span>
                </div>
              ) : voices.length > 0 ? (
                <div className="space-y-4">
                  {/* Language tabs */}
                  <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700 pb-2">
                    {allLanguages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => setSelectedLanguage(lang.code)}
                        className={cn(
                          "px-3 py-1.5 text-sm font-medium rounded-t-lg transition-colors",
                          selectedLanguage === lang.code
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-b-2 border-blue-500"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                        )}
                      >
                        {lang.name}
                        {voicesPerLanguage[lang.code]?.default && (
                          <span
                            className="ml-1 w-2 h-2 inline-block bg-green-500 rounded-full"
                            title="Configured"
                          />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Voice settings for selected language */}
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {allLanguages.find((l) => l.code === selectedLanguage)?.name} Voice
                    </h4>

                    <div>
                      <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                        Voice
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={voicesPerLanguage[selectedLanguage]?.default || ""}
                          onChange={(e) => updateLanguageVoice(selectedLanguage, e.target.value)}
                          className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                        >
                          <option value="">Select a voice...</option>
                          {voices.map((voice) => (
                            <option key={voice.voiceId} value={voice.voiceId}>
                              {voice.name}
                            </option>
                          ))}
                        </select>
                        {voicesPerLanguage[selectedLanguage]?.default && (
                          <button
                            onClick={() =>
                              playVoicePreview(
                                voicesPerLanguage[selectedLanguage].default,
                                selectedLanguage
                              )
                            }
                            disabled={previewLoading}
                            title="Preview voice in target language"
                            className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm disabled:opacity-50"
                          >
                            {previewLoading ? "..." : "▶"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                  Save settings first, then click &quot;Refresh voices&quot;
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={onTest}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Test Connection
              </button>
              {testResult && (
                <p
                  className={`text-sm ${testResult.startsWith("Error") ? "text-red-500" : "text-green-500"}`}
                >
                  {testResult}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
}
