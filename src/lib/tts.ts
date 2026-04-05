import { invoke } from "@tauri-apps/api/core";
import type { TtsVoice } from "../types";

export async function getAvailableVoices(): Promise<TtsVoice[]> {
  return invoke<TtsVoice[]>("get_available_voices");
}

export async function generateTts(
  text: string,
  phraseId?: number,
  voiceId?: string,
  language?: string,
  forceRegenerate?: boolean
): Promise<string> {
  return invoke<string>("generate_tts", { text, phraseId, voiceId, language, forceRegenerate });
}

export async function testTtsConnection(): Promise<string> {
  return invoke<string>("test_tts_connection");
}

export async function getAudioBase64(path: string): Promise<string> {
  return invoke<string>("get_audio_base64", { path });
}

/**
 * Fetch audio URL for the given text, with fallback: if the cached file no longer exists
 * on disk, regenerate it before reading. Returns the final audio path and base64 data URL.
 */
export async function fetchAudioWithFallback(
  text: string,
  audioPath: string,
  phraseId?: number,
  voiceId?: string,
  language?: string
): Promise<{ audioPath: string; audioUrl: string }> {
  let resolvedPath = audioPath;
  let audioUrl: string;
  try {
    audioUrl = await getAudioBase64(resolvedPath);
  } catch {
    // Cached file doesn't exist on disk — regenerate
    resolvedPath = await generateTts(text, phraseId, voiceId, language);
    audioUrl = await getAudioBase64(resolvedPath);
  }
  return { audioPath: resolvedPath, audioUrl };
}

/**
 * Get the configured voice ID for a specific language.
 * @returns The voice ID, or empty string if not configured.
 */
export async function getVoiceForLanguage(language: string): Promise<string> {
  return invoke<string>("get_voice_for_language", { language });
}
