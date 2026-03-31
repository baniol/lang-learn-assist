import { invoke } from "@tauri-apps/api/core";

export interface WhisperModel {
  name: string;
  fileName: string;
  sizeMb: number;
  url: string;
  description: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

// Model management
export async function getAvailableModels(): Promise<WhisperModel[]> {
  return invoke<WhisperModel[]>("get_available_models");
}

export async function getModelStatus(fileName: string): Promise<boolean> {
  return invoke<boolean>("get_model_status", { fileName });
}

export async function isModelDownloaded(): Promise<boolean> {
  return invoke<boolean>("is_model_downloaded");
}

export async function downloadModel(fileName: string): Promise<string> {
  return invoke<string>("download_model", { fileName });
}

export async function deleteModel(fileName: string): Promise<void> {
  return invoke<void>("delete_model", { fileName });
}

// Whisper
export async function initWhisper(): Promise<void> {
  return invoke<void>("init_whisper");
}

export async function isWhisperReady(): Promise<boolean> {
  return invoke<boolean>("is_whisper_ready");
}

export async function transcribeAudio(
  audioPath: string,
  language?: string,
  prompt?: string
): Promise<string> {
  return invoke<string>("transcribe_audio", { audioPath, language, prompt });
}

// Play audio file using Web Audio API
let audioContext: AudioContext | null = null;

export async function playAudioFile(filePath: string): Promise<void> {
  // Get base64 audio data from Rust
  const base64Data = await invoke<string>("get_audio_base64", { audioPath: filePath });

  // Initialize AudioContext if needed
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  // Decode base64 to ArrayBuffer
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);

  // Create and play source
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
}
