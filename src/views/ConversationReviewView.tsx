import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { extractPhrasesFromConversation } from "../lib/llm";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import type {
  Conversation,
  ChatMessage,
  SuggestedPhrase,
  CreatePhraseRequest,
  ViewType,
  AppSettings,
} from "../types";

interface ConversationReviewViewProps {
  conversationId: number;
  onNavigate: (view: ViewType, data?: unknown) => void;
}

function getGermanPhrasesFromMessages(messages: ChatMessage[]): string[] {
  return messages
    .filter((msg) => msg.role === "assistant")
    .map((msg) => msg.content);
}

export function ConversationReviewView({
  conversationId,
  onNavigate,
}: ConversationReviewViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [germanPhrases, setGermanPhrases] = useState<string[]>([]);
  const [suggestedPhrases, setSuggestedPhrases] = useState<SuggestedPhrase[]>([]);
  const [selectedPhrases, setSelectedPhrases] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const audioPlayback = useAudioPlayback({
    voiceA: settings?.ttsVoiceIdA,
    voiceB: settings?.ttsVoiceIdB,
  });

  useEffect(() => {
    loadAndProcess();
    loadSettings();
  }, [conversationId]);

  const loadSettings = async () => {
    try {
      const data = await invoke<AppSettings>("get_settings");
      setSettings(data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const loadAndProcess = async () => {
    try {
      const conv = await invoke<Conversation>("get_conversation", { id: conversationId });
      setConversation(conv);
      setTitle(conv.title);

      const messages: ChatMessage[] = JSON.parse(conv.rawMessagesJson || "[]");
      const german = getGermanPhrasesFromMessages(messages);
      setGermanPhrases(german);

      if (german.length === 0) {
        setError("No German phrases found. Go back and add some translations first.");
        setIsProcessing(false);
        return;
      }

      // Create messages for phrase extraction
      const germanMessages: ChatMessage[] = german.map((text, i) => ({
        id: `german-${i}`,
        role: "assistant" as const,
        content: text,
      }));

      const phrases = await extractPhrasesFromConversation(
        germanMessages,
        conv.targetLanguage,
        conv.nativeLanguage
      );

      setSuggestedPhrases(phrases);
      setSelectedPhrases(new Set(phrases.map((_, i) => i)));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePhrase = (index: number) => {
    setSelectedPhrases((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!conversation) return;

    setIsSaving(true);
    setError(null);

    try {
      console.log("1. Updating title...");
      await invoke("update_conversation_title", { id: conversation.id, title });
      console.log("1. Title updated");

      const finalMessages: ChatMessage[] = germanPhrases.map((text, i) => ({
        id: `final-${i}`,
        role: "assistant" as const,
        content: text,
      }));

      console.log("2. Finalizing conversation...", { id: conversation.id, finalMessages });
      await invoke("finalize_conversation", {
        id: conversation.id,
        finalMessages,
        summary: null,
      });
      console.log("2. Conversation finalized");

      const phrasesToCreate: CreatePhraseRequest[] = suggestedPhrases
        .filter((_, i) => selectedPhrases.has(i))
        .map((p) => ({
          conversationId: conversation.id,
          prompt: p.prompt,
          answer: p.answer,
          accepted: p.accepted,
          targetLanguage: conversation.targetLanguage,
          nativeLanguage: conversation.nativeLanguage,
        }));

      console.log("3. Creating phrases...", phrasesToCreate);
      if (phrasesToCreate.length > 0) {
        await invoke("create_phrases_batch", { phrases: phrasesToCreate });
        console.log("3. Phrases created");
      }

      console.log("4. Navigating to dashboard");
      onNavigate("dashboard");
    } catch (err) {
      console.error("Save failed:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        <p className="text-slate-500 dark:text-slate-400">
          Processing conversation...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <svg className="w-16 h-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate("conversation", { conversationId })}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Conversation
          </button>
          <button
            onClick={() => onNavigate("dashboard")}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate("conversation", { conversationId })}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="font-semibold text-slate-800 dark:text-white">
                Review & Save
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Review your conversation and select vocabulary to learn
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Save & Finish
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Conversation Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
            />
          </div>

          {/* Final German Conversation */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Your German Conversation ({germanPhrases.length} phrases)
              </h2>
              {germanPhrases.length > 0 && (
                <button
                  onClick={() => {
                    if (audioPlayback.isPlaying) {
                      audioPlayback.stop();
                    } else {
                      const msgs: ChatMessage[] = germanPhrases.map((text, i) => ({
                        id: `review-${i}`,
                        role: "assistant",
                        content: text,
                      }));
                      audioPlayback.playAll(msgs);
                    }
                  }}
                  disabled={audioPlayback.isLoading}
                  className={`
                    px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-2
                    ${audioPlayback.isPlaying
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {audioPlayback.isLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : audioPlayback.isPlaying ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                  {audioPlayback.isPlaying ? "Stop" : "Play All"}
                </button>
              )}
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-2 border border-green-200 dark:border-green-800">
              {germanPhrases.map((phrase, i) => {
                const messageId = `review-${i}`;
                const isCurrentPlaying = audioPlayback.currentlyPlayingId === messageId && audioPlayback.isPlaying;
                const isCurrentLoading = audioPlayback.currentlyPlayingId === messageId && audioPlayback.isLoading;
                return (
                  <div
                    key={i}
                    className="px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-green-200 dark:border-green-700"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-slate-800 dark:text-white font-medium flex-1">{phrase}</p>
                      <button
                        onClick={() => audioPlayback.playMessage(phrase, messageId, i)}
                        disabled={isCurrentLoading}
                        className={`
                          flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors
                          ${isCurrentPlaying
                            ? "bg-green-500 text-white"
                            : "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/60"
                          }
                          disabled:opacity-50
                        `}
                        title={isCurrentPlaying ? "Stop" : "Play"}
                      >
                        {isCurrentLoading ? (
                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : isCurrentPlaying ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="5" width="4" height="14" rx="1" />
                            <rect x="14" y="5" width="4" height="14" rx="1" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Suggested Phrases for Learning */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Vocabulary to Learn ({selectedPhrases.size} selected)
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPhrases(new Set(suggestedPhrases.map((_, i) => i)))}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedPhrases(new Set())}
                  className="text-sm text-slate-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {suggestedPhrases.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                No vocabulary suggestions available.
              </p>
            ) : (
              <div className="space-y-2">
                {suggestedPhrases.map((phrase, index) => (
                  <div
                    key={index}
                    onClick={() => togglePhrase(index)}
                    className={`
                      p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${
                        selectedPhrases.has(index)
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`
                          w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                          ${
                            selectedPhrases.has(index)
                              ? "border-blue-500 bg-blue-500"
                              : "border-slate-300 dark:border-slate-600"
                          }
                        `}
                      >
                        {selectedPhrases.has(index) && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-500 dark:text-slate-400">{phrase.prompt}</p>
                        <p className="font-medium text-slate-800 dark:text-white">{phrase.answer}</p>
                        {phrase.accepted.length > 0 && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            Also: {phrase.accepted.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
