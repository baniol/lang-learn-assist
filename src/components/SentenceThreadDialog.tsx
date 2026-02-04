import { useState, useEffect } from "react";
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
import { createPhrase } from "../api";
import { AIChatPanel } from "./ui";
import { CloseIcon, CheckIcon } from "./icons";

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

  useEffect(() => {
    loadThread();
  }, [material.id, segmentIndex]);

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
      let currentThread = thread;
      if (!currentThread) {
        currentThread = await createMaterialThread(material.id, segmentIndex);
        setThread(currentThread);
      }

      const userMessage: MaterialThreadMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
      };
      const updatedMessages = [...currentThread.messages, userMessage];
      setThread({ ...currentThread, messages: updatedMessages });

      const response = await askAboutSentence(
        segment.text,
        segment.translation,
        question,
        currentThread.messages,
        material.targetLanguage,
        material.nativeLanguage,
      );

      const assistantMessage: MaterialThreadMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.explanation,
      };
      const finalMessages = [...updatedMessages, assistantMessage];

      const newPhrases = [...pendingPhrases, ...response.phrases];
      setPendingPhrases(newPhrases);

      const savedThread = await updateMaterialThread(
        currentThread.id,
        finalMessages,
        newPhrases.length > 0 ? newPhrases : null,
      );
      setThread(savedThread);
    } catch (err) {
      setError(
        `Failed to get response: ${err instanceof Error ? err.message : String(err)}`,
      );
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

      await createPhrase(request);

      const updated = pendingPhrases.filter((_, i) => i !== index);
      setPendingPhrases(updated);

      if (thread) {
        await updateMaterialThread(
          thread.id,
          thread.messages,
          updated.length > 0 ? updated : null,
        );
      }
    } catch (err) {
      setError(`Failed to save phrase: ${err}`);
    }
  };

  const handleRejectPhrase = async (index: number) => {
    const updated = pendingPhrases.filter((_, i) => i !== index);
    setPendingPhrases(updated);

    if (thread) {
      try {
        await updateMaterialThread(
          thread.id,
          thread.messages,
          updated.length > 0 ? updated : null,
        );
      } catch (err) {
        console.error("Failed to update thread:", err);
      }
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
              <CloseIcon size="sm" />
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
                      <CheckIcon size="sm" />
                    </button>
                    <button
                      onClick={() => handleRejectPhrase(i)}
                      className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Dismiss"
                    >
                      <CloseIcon size="sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat */}
        <AIChatPanel
          messages={thread?.messages || []}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={handleSend}
          isLoading={isLoading}
          isSending={isSending}
          placeholder="Ask about vocabulary, grammar, usage..."
          variant="amber"
          className="flex-1 min-h-[200px] max-h-[400px]"
        />

        {/* Error display */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
