import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getSettings, saveSettings } from "../api";
import type { AppSettings } from "../types";

interface SettingsContextValue {
  /** Current settings or null if not yet loaded */
  settings: AppSettings | null;
  /** Whether settings are currently being loaded */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Update and persist settings */
  updateSettings: (settings: AppSettings) => Promise<void>;
  /** Update a single setting field */
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => Promise<void>;
  /** Reload settings from backend */
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial load - shows loading spinner
  useEffect(() => {
    const initialLoad = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getSettings();
        setSettings(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        console.error("Failed to load settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    initialLoad();
  }, []);

  const updateSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      await saveSettings(newSettings);
      setSettings(newSettings);
    } catch (err) {
      console.error("Failed to save settings:", err);
      throw err;
    }
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      if (!settings) {
        throw new Error("Settings not loaded yet");
      }
      const newSettings = { ...settings, [key]: value };
      await updateSettings(newSettings);
    },
    [settings, updateSettings]
  );

  // Refresh without showing loading spinner (doesn't unmount views)
  const refreshSettings = useCallback(async () => {
    try {
      const data = await getSettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error("Failed to refresh settings:", err);
    }
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        error,
        updateSettings,
        updateSetting,
        refreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Hook to access settings context.
 * Throws if used outside of SettingsProvider.
 */
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

/**
 * Hook to get just the settings object.
 * Returns null if settings haven't loaded yet.
 */
export function useSettingsValue(): AppSettings | null {
  const { settings } = useSettings();
  return settings;
}

/**
 * Hook to get the current target language.
 * Falls back to "de" if settings not loaded.
 */
export function useTargetLanguage(): string {
  const { settings } = useSettings();
  return settings?.targetLanguage ?? "de";
}

/**
 * Hook to get the current native language.
 * Falls back to "pl" if settings not loaded.
 */
export function useNativeLanguage(): string {
  const { settings } = useSettings();
  return settings?.nativeLanguage ?? "pl";
}
