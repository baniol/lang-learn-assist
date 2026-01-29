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
  onTranscription: (text: string) => void;
  onError?: (error: string) => void;
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
  onTranscription,
  onError,
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

      // Transcribe the audio
      const transcription = await transcribeAudio(audioPath, language);
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
  }, [onTranscription, onError]);

  // Handle Option+Space key events (Alt+Space on Windows/Linux)
  useEffect(() => {
    if (!enabled || !isAvailable) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger on Option+Space (Alt+Space)
      if (e.code !== "Space" || !e.altKey) return;
      if (e.repeat) return; // Ignore key repeat

      e.preventDefault();
      startRecording();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Stop on Space release (Alt may already be released)
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
  }, [enabled, isAvailable, startRecording, stopRecording]);

  return {
    status,
    error,
    isAvailable,
    startRecording,
    stopRecording,
  };
}
