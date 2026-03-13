// Re-export navigation types from dedicated module
export type {
  ViewType,
  ViewState,
  ViewWithData,
  ViewWithoutData,
  ViewDataFor,
  NavigateFn,
} from "./navigation";
export {
  createViewState,
  isMaterialReviewView,
  viewRequiresData,
  getParentView,
  isSubViewOf,
  getActiveNavItem,
} from "./navigation";

export interface Phrase {
  id: number;
  materialId: number | null;
  prompt: string;
  answer: string;
  accepted: string[];
  targetLanguage: string;
  nativeLanguage: string;
  audioPath: string | null;
  notes: string | null;
  starred: boolean;
  excluded: boolean;
  refined: boolean;
  createdAt: string;
}

export type LlmProvider = "openai" | "anthropic" | "none";
export type TtsProvider = "elevenlabs" | "google" | "azure" | "none";

export interface LanguageVoiceSettings {
  default: string;
  voiceA: string;
  voiceB: string;
}

export interface AppSettings {
  llmProvider: LlmProvider;
  llmApiKey: string;
  llmModel: string;
  activeWhisperModel: string;
  ttsProvider: TtsProvider;
  ttsApiKey: string;
  // Legacy voice settings (kept for migration)
  ttsVoiceId: string;
  ttsVoiceIdA: string;
  ttsVoiceIdB: string;
  // Per-language voice settings
  ttsVoicesPerLanguage: Record<string, LanguageVoiceSettings>;
  targetLanguage: string;
  nativeLanguage: string;
  fuzzyMatching: boolean;
  notesEnabled: boolean;
}

export interface WhisperModel {
  name: string;
  fileName: string;
  sizeMb: number;
  url: string;
  description: string;
}

export interface TtsVoice {
  voiceId: string;
  name: string;
  language: string;
  provider: string;
}

export interface SuggestedPhrase {
  prompt: string;
  answer: string;
  accepted: string[];
}

export interface CreatePhraseRequest {
  materialId?: number;
  prompt: string;
  answer: string;
  accepted?: string[];
  targetLanguage?: string;
  nativeLanguage?: string;
  notes?: string;
}

export interface UpdatePhraseRequest {
  prompt?: string;
  answer?: string;
  accepted?: string[];
  notes?: string;
  starred?: boolean;
  refined?: boolean;
}

export interface LlmResponse {
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface PhraseThreadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface PhraseThread {
  id: number;
  phraseId: number;
  messages: PhraseThreadMessage[];
  suggestedPrompt: string | null;
  suggestedAnswer: string | null;
  suggestedAccepted: string[] | null;
  status: "active" | "accepted" | "dismissed";
  createdAt: string;
  updatedAt: string;
}

export interface RefinePhraseSuggestion {
  prompt: string | null;
  answer: string | null;
  accepted: string[] | null;
  explanation: string;
}

export interface TranslationPreview {
  phraseId: number;
  originalAnswer: string;
  translatedAnswer: string;
  originalAccepted: string[];
  translatedAccepted: string[];
  newTargetLanguage: string;
}

export interface TopicCategory {
  id: string;
  label: string;
  icon: string;
}

export const TOPIC_CATEGORIES: TopicCategory[] = [
  { id: "restaurant", label: "At the Restaurant", icon: "🍽️" },
  { id: "shopping", label: "Shopping", icon: "🛒" },
  { id: "travel", label: "Travel & Directions", icon: "✈️" },
  { id: "hotel", label: "At the Hotel", icon: "🏨" },
  { id: "doctor", label: "At the Doctor", icon: "🏥" },
  { id: "work", label: "At Work", icon: "💼" },
  { id: "smalltalk", label: "Small Talk", icon: "💬" },
  { id: "phone", label: "Phone Calls", icon: "📞" },
  { id: "custom", label: "Custom Topic...", icon: "✏️" },
];

export const LANGUAGE_OPTIONS = [
  { code: "de", name: "German" },
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "cs", name: "Czech" },
  { code: "uk", name: "Ukrainian" },
];

export const NATIVE_LANGUAGE_OPTIONS = [
  { code: "pl", name: "Polish" },
  { code: "en", name: "English" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
];

// Question threads for grammar/style Q&A

export interface QuestionThread {
  id: number;
  title: string;
  targetLanguage: string;
  nativeLanguage: string;
  messages: QuestionMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  examples?: QuestionExample[];
}

export interface QuestionExample {
  sentence: string;
  translation: string;
  notes?: string;
}

export interface GrammarQuestionResponse {
  explanation: string;
  examples: QuestionExample[];
}

// Notes

export interface Note {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  content: string;
}

export interface UpdateNoteRequest {
  content: string;
}

// Export/Import types

export interface ExportData {
  version: number;
  exportedAt: string;
  settings: ExportSetting[];
  phrases: ExportPhrase[];
  phraseThreads: ExportPhraseThread[];
  questionThreads: ExportQuestionThread[];
  notes: ExportNote[];
  materials: ExportMaterial[];
  materialThreads: ExportMaterialThread[];
}

export interface ExportSetting {
  key: string;
  value: string;
}

export interface ExportPhrase {
  id: number;
  conversationId?: number | null; // Deprecated, kept for import compatibility
  materialId: number | null;
  prompt: string;
  answer: string;
  acceptedJson: string;
  targetLanguage: string;
  nativeLanguage: string;
  audioPath: string | null;
  notes: string | null;
  starred: boolean;
  excluded: boolean;
  createdAt: string;
}

export interface ExportPhraseThread {
  id: number;
  phraseId: number;
  messagesJson: string;
  suggestedPrompt: string | null;
  suggestedAnswer: string | null;
  suggestedAccepted: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportQuestionThread {
  id: number;
  title: string;
  targetLanguage: string;
  nativeLanguage: string;
  messagesJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportNote {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type ImportMode = "merge" | "overwrite";

export interface ImportResult {
  success: boolean;
  message: string;
  stats: ImportStats;
}

export interface ImportStats {
  settingsImported: number;
  phrasesImported: number;
  phrasesUpdated: number;
  phraseThreadsImported: number;
  questionThreadsImported: number;
  notesImported: number;
  materialsImported: number;
  materialThreadsImported: number;
}

export interface DuplicateInfo {
  answer: string;
  targetLanguage: string;
  duplicateIds: number[];
  keepId: number;
}

export interface RemoveDuplicatesResult {
  duplicatesFound: number;
  phrasesRemoved: number;
  details: DuplicateInfo[];
}

export interface ExportMaterial {
  id: number;
  title: string;
  materialType: string;
  sourceUrl: string | null;
  originalText: string;
  segmentsJson: string | null;
  targetLanguage: string;
  nativeLanguage: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportMaterialThread {
  id: number;
  materialId: number;
  segmentIndex: number;
  messagesJson: string;
  suggestedPhrasesJson: string | null;
  createdAt: string;
  updatedAt: string;
}

// Materials (YouTube transcripts, articles, etc.)

export type MaterialType = "transcript" | "text" | "audio";
export type MaterialStatus = "pending" | "processing" | "ready" | "error";

export interface Material {
  id: number;
  title: string;
  materialType: MaterialType;
  sourceUrl: string | null;
  originalText: string;
  segmentsJson: string | null;
  targetLanguage: string;
  nativeLanguage: string;
  status: MaterialStatus;
  bookmarkIndex: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TextSegment {
  text: string;
  translation: string;
  timestamp?: string;
  audioPath?: string;
}

export interface CreateMaterialRequest {
  title: string;
  materialType: MaterialType;
  sourceUrl?: string;
  originalText: string;
  targetLanguage?: string;
  nativeLanguage?: string;
}

export interface UpdateMaterialRequest {
  title?: string;
  segmentsJson?: string;
  status?: MaterialStatus;
}

export interface MaterialThread {
  id: number;
  materialId: number;
  segmentIndex: number;
  messages: MaterialThreadMessage[];
  suggestedPhrases: SuggestedPhrase[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialThreadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AskAboutSentenceResponse {
  explanation: string;
  phrases: SuggestedPhrase[];
}

export interface TokenEstimate {
  estimatedTokens: number;
  chunkCount: number;
  estimatedCostUsd: number;
}

export interface MaterialProcessingProgress {
  materialId: number;
  currentChunk: number;
  totalChunks: number;
  percent: number;
}
