import { useState, useCallback, useRef } from "react";
import { generateTts, getAudioBase64 } from "../lib/tts";
import type { ChatMessage } from "../types";

interface UseAudioPlaybackOptions {
  voiceA?: string;
  voiceB?: string;
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
  const { voiceA, voiceB } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Cache key includes voice ID to handle different voices for same text
  const audioCache = useRef<Map<string, string>>(new Map());
  const stopRequestedRef = useRef(false);

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
