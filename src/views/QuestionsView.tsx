import { useState, useCallback } from "react";
import {
  getQuestionThreads,
  getQuestionThread,
  createQuestionThread,
  deleteQuestionThread,
  askGrammarQuestion,
  updateQuestionThreadTitle,
} from "../lib/questions";
import { generateTitle } from "../lib/llm";
import { createPhrase } from "../api";
import { Button, Spinner, ConfirmDialog, AIChatPanel } from "../components/ui";
import type { ChatMessage } from "../components/ui";
import { EmptyState } from "../components/shared";
import {
  PlusIcon,
  CloseIcon,
  QuestionCircleIcon,
  CheckIcon,
} from "../components/icons";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { useQuery, useMutation } from "../hooks";
import type {
  QuestionThread,
  QuestionExample,
  CreatePhraseRequest,
} from "../types";

export function QuestionsView() {
  const { settings } = useSettings();
  const toast = useToast();
  const [selectedThread, setSelectedThread] = useState<QuestionThread | null>(
    null,
  );
  const [isSending, setIsSending] = useState(false);
  const [question, setQuestion] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [addedExamples, setAddedExamples] = useState<Set<string>>(new Set());

  // Fetch threads
  const {
    data: threads,
    isLoading,
    refetch: refetchThreads,
  } = useQuery(
    () => getQuestionThreads(settings?.targetLanguage),
    [settings?.targetLanguage],
    {
      onError: (err) => toast.error(`Failed to load threads: ${err.message}`),
    }
  );

  const handleSelectThread = async (thread: QuestionThread) => {
    try {
      const fullThread = await getQuestionThread(thread.id);
      setSelectedThread(fullThread);
      setAddedExamples(new Set());
    } catch (err) {
      toast.error(`Failed to load thread: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Create thread mutation
  const createMutation = useMutation(
    () =>
      createQuestionThread(
        "New Question",
        settings?.targetLanguage,
        settings?.nativeLanguage,
      ),
    {
      onSuccess: (thread) => {
        refetchThreads();
        setSelectedThread(thread);
        setAddedExamples(new Set());
      },
      onError: (err) => toast.error(`Failed to create thread: ${err.message}`),
    }
  );

  // Delete thread mutation
  const deleteMutation = useMutation(
    (id: number) => deleteQuestionThread(id),
    {
      onSuccess: () => {
        setDeleteConfirmId(null);
        if (selectedThread?.id === deleteConfirmId) {
          setSelectedThread(null);
        }
        refetchThreads();
        toast.success("Thread deleted");
      },
      onError: (err) => {
        setDeleteConfirmId(null);
        toast.error(`Failed to delete thread: ${err.message}`);
      },
    }
  );

  const handleDeleteThread = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
    }
  };

  const handleSendQuestion = async () => {
    if (!question.trim() || !selectedThread || isSending) return;

    const currentQuestion = question;
    const isFirstQuestion = selectedThread.messages.length === 0;
    setQuestion("");
    setIsSending(true);

    try {
      await askGrammarQuestion(selectedThread.id, currentQuestion);

      const updatedThread = await getQuestionThread(selectedThread.id);

      if (isFirstQuestion && updatedThread.messages.length >= 2) {
        try {
          const content = updatedThread.messages
            .slice(0, 2)
            .map((m) => `${m.role}: ${m.content.substring(0, 200)}`)
            .join("\n");
          const newTitle = await generateTitle(
            content,
            "question",
            settings?.nativeLanguage
          );
          await updateQuestionThreadTitle(updatedThread.id, newTitle);
          updatedThread.title = newTitle;
        } catch (err) {
          console.error("Failed to generate title:", err);
        }
      }

      setSelectedThread(updatedThread);
      refetchThreads();
    } catch (err) {
      toast.error(`Failed to ask question: ${err instanceof Error ? err.message : String(err)}`);
      setQuestion(currentQuestion);
    } finally {
      setIsSending(false);
    }
  };

  const handleAddToLibrary = useCallback(
    async (example: QuestionExample) => {
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

        await createPhrase(request);
        setAddedExamples((prev) => new Set([...prev, exampleKey]));
      } catch (err) {
        console.error("Failed to add phrase:", err);
      }
    },
    [selectedThread, addedExamples],
  );

  // Convert QuestionMessage to ChatMessage format
  const chatMessages: ChatMessage[] =
    selectedThread?.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    })) || [];

  // Render examples below assistant messages
  const renderMessageExtra = useCallback(
    (message: ChatMessage) => {
      if (!selectedThread) return null;
      const originalMessage = selectedThread.messages.find(
        (m) => m.id === message.id,
      );
      if (!originalMessage?.examples?.length) return null;

      return (
        <div className="border-t border-slate-200 dark:border-slate-600 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Examples
          </p>
          {originalMessage.examples.map((example, idx) => {
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
                  onClick={() => handleAddToLibrary(example)}
                  disabled={isAdded}
                  className={`absolute top-2 right-2 p-1.5 rounded transition-all ${
                    isAdded
                      ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  }`}
                  title={isAdded ? "Added to library" : "Add to phrase library"}
                >
                  {isAdded ? <CheckIcon size="xs" /> : <PlusIcon size="xs" />}
                </button>
              </div>
            );
          })}
        </div>
      );
    },
    [selectedThread, addedExamples, handleAddToLibrary],
  );

  return (
    <div className="flex h-full">
      {/* Thread List Sidebar */}
      <div className="w-72 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50 dark:bg-slate-800/50">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <Button
            onClick={() => createMutation.mutate(undefined as never)}
            isLoading={createMutation.isLoading}
            className="w-full"
          >
            <PlusIcon size="sm" />
            New Question
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : !threads || threads.length === 0 ? (
            <EmptyState
              icon={
                <QuestionCircleIcon
                  size="lg"
                  className="text-slate-300 dark:text-slate-600"
                />
              }
              title="No questions yet"
              description="Start by asking a grammar question"
              className="p-4"
            />
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
                      <CloseIcon size="xs" />
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
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {new Date(selectedThread.createdAt).toLocaleDateString(
                  undefined,
                  {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
              </p>
            </div>

            {/* Chat */}
            {selectedThread.messages.length === 0 ? (
              <div className="flex-1 flex flex-col">
                <EmptyState
                  icon={
                    <QuestionCircleIcon
                      size="xl"
                      className="text-slate-300 dark:text-slate-600"
                    />
                  }
                  title="Ask a question about grammar, vocabulary, or style"
                  className="flex-1"
                />
                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                  <AIChatPanel
                    messages={[]}
                    inputValue={question}
                    onInputChange={setQuestion}
                    onSend={handleSendQuestion}
                    isSending={isSending}
                    placeholder="Ask a question..."
                    multiline
                    className="!p-0 !border-0"
                    messagesClassName="hidden"
                  />
                </div>
              </div>
            ) : (
              <AIChatPanel
                messages={chatMessages}
                inputValue={question}
                onInputChange={setQuestion}
                onSend={handleSendQuestion}
                isSending={isSending}
                placeholder="Ask a follow-up question..."
                renderMessageExtra={renderMessageExtra}
                multiline
                className="flex-1"
              />
            )}
          </>
        ) : (
          <EmptyState
            icon={
              <QuestionCircleIcon
                size="xl"
                className="text-slate-300 dark:text-slate-600"
              />
            }
            title="Grammar & Style Questions"
            description="Ask questions about grammar rules, vocabulary usage, or writing style."
            className="flex-1"
          />
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteThread}
        title="Delete question thread?"
        message="This will permanently delete this thread and all its messages."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
