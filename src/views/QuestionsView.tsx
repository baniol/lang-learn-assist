import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  getQuestionThreads,
  getQuestionThread,
  createQuestionThread,
  deleteQuestionThread,
  askGrammarQuestion,
} from "../lib/questions";
import type {
  QuestionThread,
  QuestionMessage,
  QuestionExample,
  CreatePhraseRequest,
  AppSettings,
} from "../types";

export function QuestionsView() {
  const [threads, setThreads] = useState<QuestionThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<QuestionThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [question, setQuestion] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [addedExamples, setAddedExamples] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThreads();
    loadSettings();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [selectedThread?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadSettings = async () => {
    try {
      const data = await invoke<AppSettings>("get_settings");
      setSettings(data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const loadThreads = async () => {
    setIsLoading(true);
    try {
      const data = await getQuestionThreads();
      setThreads(data);
    } catch (err) {
      console.error("Failed to load threads:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectThread = async (thread: QuestionThread) => {
    try {
      const fullThread = await getQuestionThread(thread.id);
      setSelectedThread(fullThread);
      setAddedExamples(new Set());
    } catch (err) {
      console.error("Failed to load thread:", err);
    }
  };

  const handleCreateThread = async () => {
    const now = new Date();
    const title = `Question ${now.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;

    try {
      const thread = await createQuestionThread(
        title,
        settings?.targetLanguage,
        settings?.nativeLanguage
      );
      setThreads((prev) => [thread, ...prev]);
      setSelectedThread(thread);
      setAddedExamples(new Set());
    } catch (err) {
      console.error("Failed to create thread:", err);
    }
  };

  const handleDeleteThread = async () => {
    if (!deleteConfirmId) return;

    try {
      await deleteQuestionThread(deleteConfirmId);
      setThreads((prev) => prev.filter((t) => t.id !== deleteConfirmId));
      if (selectedThread?.id === deleteConfirmId) {
        setSelectedThread(null);
      }
    } catch (err) {
      console.error("Failed to delete thread:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleSendQuestion = async () => {
    if (!question.trim() || !selectedThread || isSending) return;

    const currentQuestion = question;
    setQuestion("");
    setIsSending(true);

    try {
      await askGrammarQuestion(selectedThread.id, currentQuestion);

      // Refresh the thread to get updated messages
      const updatedThread = await getQuestionThread(selectedThread.id);
      setSelectedThread(updatedThread);

      // Update thread in list
      setThreads((prev) =>
        prev.map((t) =>
          t.id === updatedThread.id ? updatedThread : t
        )
      );
    } catch (err) {
      console.error("Failed to ask question:", err);
      // Restore the question on error
      setQuestion(currentQuestion);
    } finally {
      setIsSending(false);
    }
  };

  const handleAddToLibrary = useCallback(async (example: QuestionExample) => {
    if (!selectedThread) return;

    const exampleKey = `${example.sentence}-${example.translation}`;
    if (addedExamples.has(exampleKey)) return;

    try {
      const request: CreatePhraseRequest = {
        prompt: example.translation,
        answer: example.sentence,
        notes: example.notes || undefined,
        targetLanguage: selectedThread.targetLanguage,
        nativeLanguage: selectedThread.nativeLanguage,
      };

      await invoke("create_phrase", { request });
      setAddedExamples((prev) => new Set([...prev, exampleKey]));
    } catch (err) {
      console.error("Failed to add phrase:", err);
    }
  }, [selectedThread, addedExamples]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendQuestion();
    }
  };

  return (
    <div className="flex h-full">
      {/* Thread List Sidebar */}
      <div className="w-72 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50 dark:bg-slate-800/50">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={handleCreateThread}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Question
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm">No questions yet</p>
              <p className="text-xs mt-1">Start by asking a grammar question</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  className={`p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group ${
                    selectedThread?.id === thread.id
                      ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500"
                      : ""
                  }`}
                  onClick={() => handleSelectThread(thread)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-slate-800 dark:text-white text-sm truncate">
                        {thread.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {thread.messages.length} messages
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(thread.id);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                {selectedThread.title}
              </h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedThread.messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>Ask a question about grammar, vocabulary, or style</p>
                  </div>
                </div>
              ) : (
                selectedThread.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onAddExample={handleAddToLibrary}
                    addedExamples={addedExamples}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex gap-2">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about grammar, vocabulary, or style..."
                  rows={2}
                  disabled={isSending}
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 resize-none disabled:opacity-50"
                />
                <button
                  onClick={handleSendQuestion}
                  disabled={!question.trim() || isSending}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
                >
                  {isSending ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
                Grammar & Style Questions
              </h3>
              <p className="max-w-sm">
                Ask questions about grammar rules, vocabulary usage, or writing style.
                Get explanations with example sentences you can add to your phrase library.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Delete question thread?
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              This will permanently delete this thread and all its messages.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteThread}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: QuestionMessage;
  onAddExample: (example: QuestionExample) => void;
  addedExamples: Set<string>;
}

function MessageBubble({ message, onAddExample, addedExamples }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg ${
          isUser
            ? "bg-blue-500 text-white"
            : "bg-white dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-600"
        }`}
      >
        <div className="px-4 py-3">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Examples */}
        {message.examples && message.examples.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-600 px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Examples
            </p>
            {message.examples.map((example, idx) => {
              const exampleKey = `${example.sentence}-${example.translation}`;
              const isAdded = addedExamples.has(exampleKey);

              return (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 relative group"
                >
                  <p className="font-medium text-slate-800 dark:text-white">
                    {example.sentence}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {example.translation}
                  </p>
                  {example.notes && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">
                      {example.notes}
                    </p>
                  )}
                  <button
                    onClick={() => onAddExample(example)}
                    disabled={isAdded}
                    className={`absolute top-2 right-2 p-1.5 rounded transition-all ${
                      isAdded
                        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    }`}
                    title={isAdded ? "Added to library" : "Add to phrase library"}
                  >
                    {isAdded ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
