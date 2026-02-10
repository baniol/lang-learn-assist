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
  isDeckDetailView,
  isDeckStudyView,
  viewRequiresData,
  getParentView,
  isSubViewOf,
  getActiveNavItem,
} from "./navigation";

export interface Phrase {
  id: number;
  materialId: number | null;
  deckId: number | null;
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

// Learning status - determines where phrase is in the learning lifecycle
export type LearningStatus = "inactive" | "deck_learning" | "srs_active";

export interface PhraseProgress {
  id: number;
  phraseId: number;
  correctStreak: number;
  totalAttempts: number;
  successCount: number;
  lastSeen: string | null;
  // SRS fields
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: string | null;
  // Learning status - new unified field
  learningStatus: LearningStatus;
  // Deck graduation fields
  deckCorrectCount: number;
  // Legacy field - kept for backwards compatibility
  inSrsPool: boolean;
}

export interface AnswerResult {
  progress: PhraseProgress;
  sessionStreak: number;
  isLearnedInSession: boolean;
}

// Deck types

export interface Deck {
  id: number;
  name: string;
  description: string | null;
  targetLanguage: string;
  nativeLanguage: string;
  graduationThreshold: number;
  // Future metadata fields for levels/themes
  level: string | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeckWithStats {
  deck: Deck;
  totalPhrases: number;
  graduatedCount: number;
  learningCount: number;
}

export interface CreateDeckRequest {
  name: string;
  description?: string;
  targetLanguage?: string;
  nativeLanguage?: string;
  graduationThreshold?: number;
}

export interface UpdateDeckRequest {
  name?: string;
  description?: string;
  graduationThreshold?: number;
}

export interface DeckAnswerResult {
  progress: PhraseProgress;
  deckCorrectCount: number;
  justGraduated: boolean;
  graduationThreshold: number;
}

// Deck import types - simplified format for importing pre-made decks

export interface DeckImportPhrase {
  prompt: string;
  answer: string;
  accepted?: string[];
  notes?: string;
}

export interface DeckImportData {
  name: string;
  description?: string;
  targetLanguage?: string;
  nativeLanguage?: string;
  graduationThreshold?: number;
  level?: string;
  category?: string;
  phrases: DeckImportPhrase[];
}

export interface DeckImportResult {
  success: boolean;
  deckId: number;
  deckName: string;
  phrasesImported: number;
  message: string;
}

// Unified study mode for the new API
export type StudyModeType =
  | { type: "deck_learning"; deckId: number }
  | { type: "srs_review" };

// Unified result of recording an answer in study mode
export interface StudyAnswerResult {
  progress: PhraseProgress;
  // SRS-specific fields
  sessionStreak?: number;
  isLearnedInSession?: boolean;
  // Deck-specific fields
  deckCorrectCount?: number;
  justGraduated?: boolean;
  graduationThreshold?: number;
}

export interface PhraseWithProgress {
  phrase: Phrase;
  progress: PhraseProgress | null;
}

export interface PracticeSession {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  totalPhrases: number;
  correctAnswers: number;
  exerciseMode: ExerciseMode;
  state: SessionState | null;
}

export interface SessionState {
  seenPhraseIds: number[];
  sessionStreaks: Record<number, number>;
  sessionLearnedIds: number[];
  newPhraseCount: number;
  currentPhraseId: number | null;
  inRetryMode: boolean;
  retryCount: number;
  requiresRetry: boolean;
  // Deck study fields
  deckId?: number;
  sessionType?: StudyMode;
}

// Legacy study mode type (simple string)
export type StudyMode = "srs_review" | "deck_study";

export type ExerciseMode = "speaking" | "typing" | "manual";

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
  requiredStreak: number;
  immediateRetry: boolean;
  defaultExerciseMode: ExerciseMode;
  failureRepetitions: number;
  sessionPhraseLimit: number;
  newPhrasesPerSession: number;
  newPhraseInterval: number;
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

export interface LearningStats {
  totalPhrases: number;
  learnedCount: number;
  learningCount: number;
  newCount: number;
  averageSuccessRate: number;
  totalSessions: number;
  // Deck-specific stats
  inDecksCount: number;
  graduatedToSrsCount: number;
}

export interface SrsStats {
  dueNow: number;
  overdue: number;
  dueToday: number;
  dueTomorrow: number;
  dueThisWeek: number;
  totalReviews: number;
  averageEaseFactor: number;
  intervalDistribution: IntervalDistribution;
}

export interface IntervalDistribution {
  oneDay: number;
  twoToThreeDays: number;
  fourToSevenDays: number;
  oneToTwoWeeks: number;
  twoWeeksPlus: number;
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
];

export const NATIVE_LANGUAGE_OPTIONS = [
  { code: "pl", name: "Polish" },
  { code: "en", name: "English" },
  { code: "de", name: "German" },
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
  phraseProgress: ExportPhraseProgress[];
  phraseThreads: ExportPhraseThread[];
  questionThreads: ExportQuestionThread[];
  notes: ExportNote[];
  practiceSessions: ExportPracticeSession[];
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

export interface ExportPhraseProgress {
  id: number;
  phraseId: number;
  correctStreak: number;
  totalAttempts: number;
  successCount: number;
  lastSeen: string | null;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: string | null;
  inSrsPool: boolean;
  deckCorrectCount: number;
  learningStatus: string;
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

export interface ExportPracticeSession {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  totalPhrases: number;
  correctAnswers: number;
  exerciseMode: string;
  stateJson: string | null;
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
  phraseProgressImported: number;
  phraseThreadsImported: number;
  questionThreadsImported: number;
  notesImported: number;
  practiceSessionsImported: number;
  materialsImported: number;
  materialThreadsImported: number;
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
