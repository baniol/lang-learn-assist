import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { suggestConversationCleanup } from "../lib/llm";
import type {
  Conversation,
  ChatMessage,
  SuggestedPhrase,
  CreatePhraseRequest,
  ViewType,
} from "../types";

interface ConversationReviewViewProps {
  conversationId: number;
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function ConversationReviewView({
  conversationId,
  onNavigate,
}: ConversationReviewViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [cleanedMessages, setCleanedMessages] = useState<ChatMessage[]>([]);
  const [suggestedPhrases, setSuggestedPhrases] = useState<SuggestedPhrase[]>([]);
  const [selectedPhrases, setSelectedPhrases] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadAndProcess();
  }, [conversationId]);

  const loadAndProcess = async () => {
    try {
      const conv = await invoke<Conversation>("get_conversation", { id: conversationId });
      setConversation(conv);

      const messages: ChatMessage[] = JSON.parse(conv.rawMessagesJson || "[]");

      if (messages.length === 0) {
        setError("No messages to process");
        setIsProcessing(false);
        return;
      }

      const result = await suggestConversationCleanup(
        messages,
        conv.targetLanguage,
        conv.nativeLanguage
      );

      setTitle(result.title);
      setCleanedMessages(result.cleanedMessages);
      setSuggestedPhrases(result.suggestedPhrases);
      setSelectedPhrases(new Set(result.suggestedPhrases.map((_, i) => i)));
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
    try {
      // Update conversation title
      await invoke("update_conversation_title", { id: conversation.id, title });

      // Finalize conversation
      await invoke("finalize_conversation", {
        id: conversation.id,
        finalMessages: cleanedMessages,
        summary: null,
      });

      // Create selected phrases
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

      if (phrasesToCreate.length > 0) {
        await invoke("create_phrases_batch", { phrases: phrasesToCreate });
      }

      onNavigate("dashboard");
    } catch (err) {
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
          Processing conversation with AI...
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
        <button
          onClick={() => onNavigate("dashboard")}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
        >
          Back to Dashboard
        </button>
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
                Review the conversation and select phrases to learn
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

          {/* Cleaned Conversation */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">
              Cleaned Conversation
            </h2>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
              {cleanedMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg ${
                      msg.role === "user"
                        ? "bg-blue-500 text-white"
                        : "bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600"
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested Phrases */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Suggested Phrases ({selectedPhrases.size} selected)
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
          </div>
        </div>
      </div>
    </div>
  );
}
