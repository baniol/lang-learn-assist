import { useState, useCallback, useRef, useEffect } from "react";
import { generateTts, getAudioBase64, getVoiceForLanguage } from "../lib/tts";

/** Chat message type for audio playback */
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** Maximum number of audio files to keep in cache */
const MAX_AUDIO_CACHE_SIZE = 50;

interface UseAudioPlaybackOptions {
  /** Explicit voice A ID (legacy) */
  voiceA?: string;
  /** Explicit voice B ID (legacy) */
  voiceB?: string;
  /** Language code to look up per-language voices (takes precedence) */
  language?: string;
}

interface UseAudioPlaybackResult {
  isPlaying: boolean;
  isLoading: boolean;
  currentlyPlayingId: string | null;
  error: string | null;
  playMessage: (text: string, messageId: string, voiceIndex?: number) => Promise<void>;
  playAll: (messages: ChatMessage[]) => Promise<void>;
  stop: () => void;
}

export function useAudioPlayback(options: UseAudioPlaybackOptions = {}): UseAudioPlaybackResult {
  const { voiceA: explicitVoiceA, voiceB: explicitVoiceB, language } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Per-language voices (loaded when language is provided)
  const [languageVoiceA, setLanguageVoiceA] = useState<string | undefined>(undefined);
  const [languageVoiceB, setLanguageVoiceB] = useState<string | undefined>(undefined);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Cache key includes voice ID to handle different voices for same text
  const audioCache = useRef<Map<string, string>>(new Map());
  const stopRequestedRef = useRef(false);

  // Load per-language voices when language changes
  useEffect(() => {
    let mounted = true;

    if (language) {
      Promise.all([
        getVoiceForLanguage(language, "voiceA"),
        getVoiceForLanguage(language, "voiceB"),
      ])
        .then(([a, b]) => {
          if (mounted) {
            setLanguageVoiceA(a || undefined);
            setLanguageVoiceB(b || undefined);
          }
        })
        .catch((err) => {
          if (mounted) {
            console.error("Failed to load per-language voices:", err);
          }
        });
    } else {
      setLanguageVoiceA(undefined);
      setLanguageVoiceB(undefined);
    }

    return () => {
      mounted = false;
    };
  }, [language]);

  // Use per-language voices if language is set, otherwise fall back to explicit options
  const voiceA = language ? languageVoiceA : explicitVoiceA;
  const voiceB = language ? languageVoiceB : explicitVoiceB;

  const getVoiceForIndex = useCallback(
    (index: number): string | undefined => {
      // If neither voice is set, use default (undefined)
      if (!voiceA && !voiceB) return undefined;
      // Alternate between voiceA and voiceB
      return index % 2 === 0 ? voiceA || voiceB : voiceB || voiceA;
    },
    [voiceA, voiceB]
  );

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentlyPlayingId(null);
  }, []);

  const playMessage = useCallback(
    async (text: string, messageId: string, voiceIndex?: number): Promise<void> => {
      // If same message is playing, stop it
      if (currentlyPlayingId === messageId && isPlaying) {
        stop();
        return;
      }

      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }

      stopRequestedRef.current = false;
      setError(null);
      setCurrentlyPlayingId(messageId);
      setIsLoading(true);

      try {
        // Determine voice to use
        const voiceId = voiceIndex !== undefined ? getVoiceForIndex(voiceIndex) : undefined;

        // Cache key includes voice to differentiate
        const cacheKey = voiceId ? `${text}::${voiceId}` : text;

        // Check cache first
        let audioPath = audioCache.current.get(cacheKey);

        if (!audioPath) {
          audioPath = await generateTts(text, undefined, voiceId);
          // Evict oldest entry if cache is full (simple LRU)
          if (audioCache.current.size >= MAX_AUDIO_CACHE_SIZE) {
            const oldestKey = audioCache.current.keys().next().value;
            if (oldestKey) audioCache.current.delete(oldestKey);
          }
          audioCache.current.set(cacheKey, audioPath);
        }

        if (stopRequestedRef.current) return;

        // Get audio as base64 data URL
        let audioUrl: string;
        try {
          audioUrl = await getAudioBase64(audioPath);
        } catch {
          // Cached file doesn't exist, regenerate
          audioPath = await generateTts(text, undefined, voiceId);
          audioCache.current.set(cacheKey, audioPath);
          audioUrl = await getAudioBase64(audioPath);
        }

        if (stopRequestedRef.current) return;

        return new Promise((resolve, reject) => {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;

          audio.onended = () => {
            setIsPlaying(false);
            setCurrentlyPlayingId(null);
            audioRef.current = null;
            resolve();
          };

          audio.onerror = () => {
            const errorMsg = "Failed to play audio";
            setError(errorMsg);
            setIsPlaying(false);
            setCurrentlyPlayingId(null);
            audioRef.current = null;
            reject(new Error(errorMsg));
          };

          setIsLoading(false);
          setIsPlaying(true);
          audio.play().catch(reject);
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        setIsLoading(false);
        setIsPlaying(false);
        setCurrentlyPlayingId(null);
        throw err;
      }
    },
    [currentlyPlayingId, isPlaying, stop, getVoiceForIndex]
  );

  const playAll = useCallback(
    async (messages: ChatMessage[]): Promise<void> => {
      const assistantMessages = messages.filter((m) => m.role === "assistant");

      if (assistantMessages.length === 0) return;

      stopRequestedRef.current = false;

      for (let i = 0; i < assistantMessages.length; i++) {
        if (stopRequestedRef.current) break;

        const msg = assistantMessages[i];
        try {
          await playMessage(msg.content, msg.id, i);
        } catch {
          // Continue with next message even if one fails
          if (stopRequestedRef.current) break;
        }
      }
    },
    [playMessage]
  );

  return {
    isPlaying,
    isLoading,
    currentlyPlayingId,
    error,
    playMessage,
    playAll,
    stop,
  };
}
