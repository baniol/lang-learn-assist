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
  prompt?: string,
): Promise<string> {
  return invoke<string>("transcribe_audio", { audioPath, language, prompt });
}
