import { invoke } from "@tauri-apps/api/core";
import type {
  Material,
  CreateMaterialRequest,
  UpdateMaterialRequest,
  MaterialType,
  MaterialThread,
  MaterialThreadMessage,
  SuggestedPhrase,
  AskAboutSentenceResponse,
  TokenEstimate,
} from "../types";

export async function createMaterial(
  request: CreateMaterialRequest
): Promise<Material> {
  return invoke<Material>("create_material", { request });
}

export async function getMaterials(
  targetLanguage?: string,
  materialType?: MaterialType
): Promise<Material[]> {
  return invoke<Material[]>("get_materials", { targetLanguage, materialType });
}

export async function getMaterial(id: number): Promise<Material> {
  return invoke<Material>("get_material", { id });
}

export async function updateMaterial(
  id: number,
  request: UpdateMaterialRequest
): Promise<Material> {
  return invoke<Material>("update_material", { id, request });
}

export async function deleteMaterial(id: number): Promise<void> {
  return invoke<void>("delete_material", { id });
}

export async function updateMaterialBookmark(
  id: number,
  bookmarkIndex: number | null
): Promise<void> {
  return invoke<void>("update_material_bookmark", { id, bookmarkIndex });
}

export async function processMaterial(
  materialId: number,
  materialType: MaterialType,
  text: string,
  targetLanguage: string,
  nativeLanguage: string
): Promise<string> {
  return invoke<string>("process_material", {
    materialId,
    materialType,
    text,
    targetLanguage,
    nativeLanguage,
  });
}

// Material Threads

export async function getMaterialThread(
  materialId: number,
  segmentIndex: number
): Promise<MaterialThread | null> {
  return invoke<MaterialThread | null>("get_material_thread", {
    materialId,
    segmentIndex,
  });
}

export async function createMaterialThread(
  materialId: number,
  segmentIndex: number
): Promise<MaterialThread> {
  return invoke<MaterialThread>("create_material_thread", {
    materialId,
    segmentIndex,
  });
}

export async function updateMaterialThread(
  threadId: number,
  messages: MaterialThreadMessage[],
  suggestedPhrases: SuggestedPhrase[] | null
): Promise<MaterialThread> {
  return invoke<MaterialThread>("update_material_thread", {
    threadId,
    messages,
    suggestedPhrases,
  });
}

export async function deleteMaterialThread(threadId: number): Promise<void> {
  return invoke<void>("delete_material_thread", { threadId });
}

export async function getMaterialThreadIndices(materialId: number): Promise<[number, string][]> {
  return invoke<[number, string][]>("get_material_thread_indices", { materialId });
}

export async function estimateMaterialTokens(
  text: string,
  materialType: MaterialType
): Promise<TokenEstimate> {
  return invoke<TokenEstimate>("estimate_material_tokens", { text, materialType });
}

// Audio segment input for processing
export interface AudioSegmentInput {
  text: string;
  audioPath: string;
}

// Process audio segments: translate transcriptions and return complete segments
export async function processAudioSegments(
  materialId: number,
  segments: AudioSegmentInput[],
  targetLanguage: string,
  nativeLanguage: string
): Promise<string> {
  return invoke<string>("process_audio_segments", {
    materialId,
    segments,
    targetLanguage,
    nativeLanguage,
  });
}

export async function askAboutSentence(
  sentence: string,
  translation: string,
  question: string,
  previousMessages: MaterialThreadMessage[],
  targetLanguage: string,
  nativeLanguage: string
): Promise<AskAboutSentenceResponse> {
  return invoke<AskAboutSentenceResponse>("ask_about_sentence", {
    sentence,
    translation,
    question,
    previousMessages,
    targetLanguage,
    nativeLanguage,
  });
}

