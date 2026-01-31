import { invoke } from "@tauri-apps/api/core";
import type { TtsVoice } from "../types";

export async function getAvailableVoices(): Promise<TtsVoice[]> {
  return invoke<TtsVoice[]>("get_available_voices");
}

export async function generateTts(
  text: string,
  phraseId?: number,
  voiceId?: string
): Promise<string> {
  return invoke<string>("generate_tts", { text, phraseId, voiceId });
}

export async function testTtsConnection(): Promise<string> {
  return invoke<string>("test_tts_connection");
}

export async function getAudioBase64(path: string): Promise<string> {
  return invoke<string>("get_audio_base64", { path });
}
