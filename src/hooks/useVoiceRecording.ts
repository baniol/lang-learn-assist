import { useState, useEffect, useCallback, useRef } from "react";
import {
  startRecording as micStart,
  stopRecording as micStop,
} from "tauri-plugin-mic-recorder-api";
import {
  initWhisper,
  isWhisperReady,
  isModelDownloaded,
  transcribeAudio,
} from "../lib/audio";

export type RecordingStatus = "idle" | "recording" | "transcribing" | "error";

interface UseVoiceRecordingOptions {
  enabled: boolean;
  language?: string;
  /** Hint to Whisper about expected phrase - improves accuracy significantly */
  prompt?: string;
  onTranscription: (text: string) => void;
  onError?: (error: string) => void;
  disableSpaceKey?: boolean;
}

interface UseVoiceRecordingResult {
  status: RecordingStatus;
  error: string | null;
  isAvailable: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
}

export function useVoiceRecording({
  enabled,
  language,
  prompt,
  onTranscription,
  onError,
  disableSpaceKey = false,
}: UseVoiceRecordingOptions): UseVoiceRecordingResult {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const isRecordingRef = useRef(false);
  const whisperInitialized = useRef(false);

  // Check if voice recording is available (model downloaded)
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const modelDownloaded = await isModelDownloaded();
        setIsAvailable(modelDownloaded);
      } catch {
        setIsAvailable(false);
      }
    };

    if (enabled) {
      checkAvailability();
    }
  }, [enabled]);

  // Initialize Whisper when first needed
  const ensureWhisperReady = useCallback(async () => {
    if (whisperInitialized.current) {
      return true;
    }

    try {
      const ready = await isWhisperReady();
      if (ready) {
        whisperInitialized.current = true;
        return true;
      }

      await initWhisper();
      whisperInitialized.current = true;
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      onError?.(errorMsg);
      return false;
    }
  }, [onError]);

  const startRecording = useCallback(async () => {
    if (!enabled || !isAvailable || isRecordingRef.current) return;

    try {
      // Ensure Whisper is ready before recording
      const ready = await ensureWhisperReady();
      if (!ready) return;

      setError(null);
      setStatus("recording");
      isRecordingRef.current = true;

      await micStart();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      setStatus("error");
      isRecordingRef.current = false;
      onError?.(errorMsg);
    }
  }, [enabled, isAvailable, ensureWhisperReady, onError]);

  const stopRecording = useCallback(async () => {
    if (!isRecordingRef.current) return;

    try {
      setStatus("transcribing");
      const audioPath = await micStop();
      isRecordingRef.current = false;

      if (!audioPath) {
        setStatus("idle");
        return;
      }

      // Transcribe the audio (prompt hints at expected phrase for better accuracy)
      const transcription = await transcribeAudio(audioPath, language, prompt);
      setStatus("idle");

      if (transcription && transcription.trim()) {
        onTranscription(transcription.trim());
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      setStatus("error");
      isRecordingRef.current = false;
      onError?.(errorMsg);

      // Reset to idle after error
      setTimeout(() => setStatus("idle"), 2000);
    }
  }, [language, prompt, onTranscription, onError]);

  // Handle Space key events for voice recording
  useEffect(() => {
    if (!enabled || !isAvailable || disableSpaceKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (e.repeat) return; // Ignore key repeat

      // Don't trigger if typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      e.preventDefault();
      startRecording();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!isRecordingRef.current) return;

      e.preventDefault();
      stopRecording();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, isAvailable, disableSpaceKey, startRecording, stopRecording]);

  return {
    status,
    error,
    isAvailable,
    startRecording,
    stopRecording,
  };
}
