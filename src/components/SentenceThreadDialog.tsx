import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  Material,
  TextSegment,
  MaterialThread,
  MaterialThreadMessage,
  SuggestedPhrase,
  CreatePhraseRequest,
} from "../types";
import {
  getMaterialThread,
  createMaterialThread,
  updateMaterialThread,
  askAboutSentence,
} from "../lib/materials";

interface SentenceThreadDialogProps {
  material: Material;
  segment: TextSegment;
  segmentIndex: number;
  onClose: () => void;
}

export function SentenceThreadDialog({
  material,
  segment,
  segmentIndex,
  onClose,
}: SentenceThreadDialogProps) {
  const [thread, setThread] = useState<MaterialThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [pendingPhrases, setPendingPhrases] = useState<SuggestedPhrase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThread();
  }, [material.id, segmentIndex]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages]);

  const loadThread = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const existingThread = await getMaterialThread(material.id, segmentIndex);
      if (existingThread) {
        setThread(existingThread);
        if (existingThread.suggestedPhrases) {
          setPendingPhrases(existingThread.suggestedPhrases);
        }
      }
    } catch (err) {
      setError(`Failed to load thread: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    setIsSending(true);
    setError(null);
    const question = inputValue.trim();
    setInputValue("");

    try {
      // Create thread if doesn't exist
      let currentThread = thread;
      if (!currentThread) {
        currentThread = await createMaterialThread(material.id, segmentIndex);
        setThread(currentThread);
      }

      // Add user message to UI immediately
      const userMessage: MaterialThreadMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
      };
      const updatedMessages = [...currentThread.messages, userMessage];
      setThread({ ...currentThread, messages: updatedMessages });

      // Call LLM
      const response = await askAboutSentence(
        segment.text,
        segment.translation,
        question,
        currentThread.messages,
        material.targetLanguage,
        material.nativeLanguage
      );

      // Add assistant message
      const assistantMessage: MaterialThreadMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.explanation,
      };
      const finalMessages = [...updatedMessages, assistantMessage];

      // Update pending phrases
      const newPhrases = [...pendingPhrases, ...response.phrases];
      setPendingPhrases(newPhrases);

      // Save to database
      const savedThread = await updateMaterialThread(
        currentThread.id,
        finalMessages,
        newPhrases.length > 0 ? newPhrases : null
      );
      setThread(savedThread);
    } catch (err) {
      setError(`Failed to get response: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleAcceptPhrase = async (phrase: SuggestedPhrase, index: number) => {
    try {
      const request: CreatePhraseRequest = {
        materialId: material.id,
        prompt: phrase.prompt,
        answer: phrase.answer,
        accepted: phrase.accepted || [],
        targetLanguage: material.targetLanguage,
        nativeLanguage: material.nativeLanguage,
      };

      await invoke("create_phrase", { request });

      // Remove from pending
      const updated = pendingPhrases.filter((_, i) => i !== index);
      setPendingPhrases(updated);

      // Update thread in DB
      if (thread) {
        await updateMaterialThread(thread.id, thread.messages, updated.length > 0 ? updated : null);
      }
    } catch (err) {
      setError(`Failed to save phrase: ${err}`);
    }
  };

  const handleRejectPhrase = async (index: number) => {
    const updated = pendingPhrases.filter((_, i) => i !== index);
    setPendingPhrases(updated);

    // Update thread in DB
    if (thread) {
      try {
        await updateMaterialThread(thread.id, thread.messages, updated.length > 0 ? updated : null);
      } catch (err) {
        console.error("Failed to update thread:", err);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              Ask About Sentence
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sentence context */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Original ({material.targetLanguage.toUpperCase()})
              </label>
              <p className="text-slate-800 dark:text-white font-medium mt-1">
                {segment.text}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Translation ({material.nativeLanguage.toUpperCase()})
              </label>
              <p className="text-slate-600 dark:text-slate-300 mt-1">
                {segment.translation}
              </p>
            </div>
          </div>
        </div>

        {/* Suggested Phrases */}
        {pendingPhrases.length > 0 && (
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Suggested Phrases ({pendingPhrases.length})
            </p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {pendingPhrases.map((phrase, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 dark:text-white truncate">
                      {phrase.answer}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {phrase.prompt}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleAcceptPhrase(phrase, i)}
                      className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                      title="Add to phrases"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRejectPhrase(i)}
                      className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Dismiss"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[100px] max-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : (!thread || thread.messages.length === 0) ? (
            <div className="py-4" />
          ) : (
            thread.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-2">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error display */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Input area */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about vocabulary, grammar, usage..."
              disabled={isLoading || isSending}
              className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 disabled:opacity-50 text-sm"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading || isSending}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
