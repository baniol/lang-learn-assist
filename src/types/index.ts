export type ViewType =
  | "dashboard"
  | "conversation"
  | "conversation-review"
  | "phrase-library"
  | "learn"
  | "stats"
  | "questions"
  | "settings";

export type ConversationStatus = "draft" | "finalized" | "archived";

export interface Conversation {
  id: number;
  title: string;
  subject: string;
  targetLanguage: string;
  nativeLanguage: string;
  status: ConversationStatus;
  rawMessagesJson: string;
  finalMessagesJson: string | null;
  llmSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface Phrase {
  id: number;
  conversationId: number | null;
  prompt: string;
  answer: string;
  accepted: string[];
  targetLanguage: string;
  nativeLanguage: string;
  audioPath: string | null;
  notes: string | null;
  starred: boolean;
  excluded: boolean;
  createdAt: string;
}

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
}

export type ExerciseMode = "speaking" | "typing" | "manual";

export type LlmProvider = "openai" | "anthropic" | "none";
export type TtsProvider = "elevenlabs" | "google" | "azure" | "none";

export interface AppSettings {
  llmProvider: LlmProvider;
  llmApiKey: string;
  llmModel: string;
  activeWhisperModel: string;
  ttsProvider: TtsProvider;
  ttsApiKey: string;
  ttsVoiceId: string;
  targetLanguage: string;
  nativeLanguage: string;
  requiredStreak: number;
  immediateRetry: boolean;
  defaultExerciseMode: ExerciseMode;
  failureRepetitions: number;
  sessionPhraseLimit: number;
  newPhrasesPerSession: number;
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

export interface ConversationCleanupResult {
  title: string;
  cleanedMessages: ChatMessage[];
  suggestedPhrases: SuggestedPhrase[];
}

export interface SuggestedPhrase {
  prompt: string;
  answer: string;
  accepted: string[];
}

export interface CreateConversationRequest {
  title: string;
  subject: string;
  targetLanguage?: string;
  nativeLanguage?: string;
}

export interface CreatePhraseRequest {
  conversationId?: number;
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
