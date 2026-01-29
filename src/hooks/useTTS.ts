import { useState, useCallback, useRef } from "react";
import { generateTts } from "../lib/tts";
import { convertFileSrc } from "@tauri-apps/api/core";

interface UseTTSOptions {
  enabled: boolean;
  onError?: (error: string) => void;
}

interface UseTTSResult {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  speak: (text: string, phraseId?: number, cachedPath?: string) => Promise<void>;
  stop: () => void;
}

export function useTTS({ enabled, onError }: UseTTSOptions): UseTTSResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const speak = useCallback(
    async (text: string, phraseId?: number, cachedPath?: string) => {
      if (!enabled) return;

      stop();
      setError(null);
      setIsLoading(true);

      try {
        let audioPath = cachedPath;

        if (!audioPath) {
          audioPath = await generateTts(text, phraseId);
        }

        const audioUrl = convertFileSrc(audioPath);
        const audio = new Audio(audioUrl);

        audioRef.current = audio;

        audio.onended = () => {
          setIsPlaying(false);
          audioRef.current = null;
        };

        audio.onerror = () => {
          const errorMsg = "Failed to play audio";
          setError(errorMsg);
          setIsPlaying(false);
          audioRef.current = null;
          onError?.(errorMsg);
        };

        setIsLoading(false);
        setIsPlaying(true);
        await audio.play();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        setIsLoading(false);
        setIsPlaying(false);
        onError?.(errorMsg);
      }
    },
    [enabled, stop, onError]
  );

  return {
    isPlaying,
    isLoading,
    error,
    speak,
    stop,
  };
}
