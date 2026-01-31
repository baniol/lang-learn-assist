import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  Phrase,
  PhraseThread,
  PhraseThreadMessage,
  RefinePhraseSuggestion,
} from "../types";
import {
  getPhraseThread,
  createPhraseThread,
  updatePhraseThread,
  acceptPhraseThread,
  deletePhraseThread,
  refinePhrase,
} from "../lib/phrases";
import { generateTts, getAudioBase64 } from "../lib/tts";

type EditMode = "ai" | "manual";

interface PhraseRefinementDialogProps {
  phrase: Phrase;
  onClose: () => void;
  onAccept: (
    prompt: string,
    answer: string,
    accepted: string[]
  ) => Promise<void>;
  onAudioRegenerated?: (audioPath: string) => void;
  /** Optional initial message to send automatically when dialog opens (e.g., user's answer context) */
  initialMessage?: string;
}

export function PhraseRefinementDialog({
  phrase,
  onClose,
  onAccept,
  onAudioRegenerated,
  initialMessage,
}: PhraseRefinementDialogProps) {
  const [mode, setMode] = useState<EditMode>("ai");
  const [initialMessageSent, setInitialMessageSent] = useState(false);
  const [thread, setThread] = useState<PhraseThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio state
  const [audioPath, setAudioPath] = useState<string | null>(phrase.audioPath);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pending AI suggestions (not yet accepted by user)
  const [pendingSuggestion, setPendingSuggestion] =
    useState<RefinePhraseSuggestion | null>(null);

  // Accepted values (what user has confirmed)
  const [editedPrompt, setEditedPrompt] = useState(phrase.prompt);
  const [editedAnswer, setEditedAnswer] = useState(phrase.answer);
  const [editedAccepted, setEditedAccepted] = useState(phrase.accepted.join(", "));

  useEffect(() => {
    if (mode === "ai") {
      loadOrCreateThread();
    }
  }, [phrase.id, mode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages]);

  // Auto-send initial message if provided and thread is ready
  useEffect(() => {
    if (initialMessage && thread && !initialMessageSent && !isLoading && mode === "ai") {
      setInitialMessageSent(true);
      setUserInput(initialMessage);
      // Trigger send after a short delay to ensure state is updated
      setTimeout(() => {
        sendInitialMessage(initialMessage);
      }, 100);
    }
  }, [initialMessage, thread, initialMessageSent, isLoading, mode]);

  const sendInitialMessage = async (message: string) => {
    if (!thread || isSending) return;

    setUserInput("");
    setIsSending(true);
    setError(null);

    const userMessage: PhraseThreadMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };
    const updatedMessages = [...thread.messages, userMessage];
    setThread({ ...thread, messages: updatedMessages });

    try {
      const currentPhrase: Phrase = {
        ...phrase,
        prompt: editedPrompt,
        answer: editedAnswer,
        accepted: editedAccepted.split(",").map((s) => s.trim()).filter(Boolean),
      };

      const suggestion = await refinePhrase(
        currentPhrase,
        thread.messages,
        message
      );

      const assistantMessage: PhraseThreadMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: suggestion.explanation,
      };
      const finalMessages = [...updatedMessages, assistantMessage];

      const updatedThread = await updatePhraseThread(
        thread.id,
        finalMessages,
        null,
        null,
        null
      );

      setThread(updatedThread);

      if (suggestion.prompt || suggestion.answer || suggestion.accepted) {
        setPendingSuggestion(suggestion);
      }
    } catch (err) {
      setError(`Failed to get refinement: ${err}`);
      setThread({ ...thread, messages: thread.messages });
    } finally {
      setIsSending(false);
    }
  };

  const loadOrCreateThread = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let existingThread = await getPhraseThread(phrase.id);
      if (!existingThread) {
        existingThread = await createPhraseThread(phrase.id);
      }
      setThread(existingThread);
    } catch (err) {
      setError(`Failed to load thread: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!userInput.trim() || !thread || isSending) return;

    const messageText = userInput.trim();
    setUserInput("");
    setIsSending(true);
    setError(null);

    // Add user message to local state immediately
    const userMessage: PhraseThreadMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
    };
    const updatedMessages = [...thread.messages, userMessage];
    setThread({ ...thread, messages: updatedMessages });

    try {
      // Build phrase with current edits for context
      const currentPhrase: Phrase = {
        ...phrase,
        prompt: editedPrompt,
        answer: editedAnswer,
        accepted: editedAccepted.split(",").map((s) => s.trim()).filter(Boolean),
      };

      // Get refinement suggestion from LLM
      const suggestion = await refinePhrase(
        currentPhrase,
        thread.messages,
        messageText
      );

      // Add assistant message
      const assistantMessage: PhraseThreadMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: suggestion.explanation,
      };
      const finalMessages = [...updatedMessages, assistantMessage];

      // Update thread in database (just messages, not auto-applying suggestions)
      const updatedThread = await updatePhraseThread(
        thread.id,
        finalMessages,
        null,
        null,
        null
      );

      setThread(updatedThread);

      // Set pending suggestion for user to review
      if (suggestion.prompt || suggestion.answer || suggestion.accepted) {
        setPendingSuggestion(suggestion);
      }
    } catch (err) {
      setError(`Failed to get refinement: ${err}`);
      // Remove the optimistic user message on error
      setThread({ ...thread, messages: thread.messages });
    } finally {
      setIsSending(false);
    }
  };

  const handleAcceptSuggestion = (field: "prompt" | "answer" | "accepted") => {
    if (!pendingSuggestion) return;

    if (field === "prompt" && pendingSuggestion.prompt) {
      setEditedPrompt(pendingSuggestion.prompt);
      setPendingSuggestion((prev) =>
        prev ? { ...prev, prompt: null } : null
      );
    } else if (field === "answer" && pendingSuggestion.answer) {
      setEditedAnswer(pendingSuggestion.answer);
      setPendingSuggestion((prev) =>
        prev ? { ...prev, answer: null } : null
      );
    } else if (field === "accepted" && pendingSuggestion.accepted) {
      setEditedAccepted(pendingSuggestion.accepted.join(", "));
      setPendingSuggestion((prev) =>
        prev ? { ...prev, accepted: null } : null
      );
    }
  };

  const handleRejectSuggestion = (field: "prompt" | "answer" | "accepted") => {
    if (!pendingSuggestion) return;

    if (field === "prompt") {
      setPendingSuggestion((prev) =>
        prev ? { ...prev, prompt: null } : null
      );
    } else if (field === "answer") {
      setPendingSuggestion((prev) =>
        prev ? { ...prev, answer: null } : null
      );
    } else if (field === "accepted") {
      setPendingSuggestion((prev) =>
        prev ? { ...prev, accepted: null } : null
      );
    }
  };

  const handleSave = async () => {
    if (isAccepting) return;

    setIsAccepting(true);
    setError(null);

    try {
      const finalAccepted = editedAccepted
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Update the phrase via parent callback
      await onAccept(editedPrompt, editedAnswer, finalAccepted);

      // Mark thread as accepted if we have one
      if (thread) {
        await acceptPhraseThread(thread.id);
      }

      onClose();
    } catch (err) {
      setError(`Failed to save changes: ${err}`);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDismiss = async () => {
    if (thread) {
      try {
        await deletePhraseThread(thread.id);
      } catch (err) {
        console.error("Failed to delete thread:", err);
      }
    }
    onClose();
  };

  const handlePlayAudio = async () => {
    if (!audioPath) return;

    if (isPlayingAudio && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlayingAudio(false);
      return;
    }

    try {
      const audioUrl = await getAudioBase64(audioPath);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlayingAudio(false);
        audioRef.current = null;
      };

      setIsPlayingAudio(true);
      await audio.play();
    } catch (err) {
      console.error("Failed to play audio:", err);
      setError("Failed to play audio");
    }
  };

  const handleRegenerateAudio = async () => {
    setIsGeneratingAudio(true);
    setError(null);

    try {
      // Use current edited answer for regeneration
      const newPath = await generateTts(editedAnswer, phrase.id);
      setAudioPath(newPath);

      // Update in database
      await invoke("update_phrase_audio", { id: phrase.id, audioPath: newPath });

      // Notify parent
      onAudioRegenerated?.(newPath);
    } catch (err) {
      console.error("Failed to regenerate audio:", err);
      setError(`Failed to regenerate audio: ${err}`);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Check if there are any changes from original
  const hasChanges =
    editedPrompt !== phrase.prompt ||
    editedAnswer !== phrase.answer ||
    editedAccepted !== phrase.accepted.join(", ");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header with mode tabs */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">
              Edit Phrase
            </h2>
            <button
              onClick={handleDismiss}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("manual")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === "manual"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              Manual Edit
            </button>
            <button
              onClick={() => setMode("ai")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                mode === "ai"
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI Assistant
            </button>
          </div>
        </div>

        {/* Current phrase / Edit fields */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
          <div className="space-y-4">
            {/* Prompt field */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                Prompt (native language)
              </label>
              {mode === "manual" ? (
                <input
                  type="text"
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-slate-700 dark:text-slate-200 py-2">
                    {editedPrompt}
                  </p>
                  {pendingSuggestion?.prompt && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                      <span className="text-sm text-purple-700 dark:text-purple-300">
                        {pendingSuggestion.prompt}
                      </span>
                      <button
                        onClick={() => handleAcceptSuggestion("prompt")}
                        className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                        title="Accept"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRejectSuggestion("prompt")}
                        className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        title="Reject"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Answer field */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                Answer (target language)
              </label>
              {mode === "manual" ? (
                <input
                  type="text"
                  value={editedAnswer}
                  onChange={(e) => setEditedAnswer(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-medium"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-slate-800 dark:text-white font-medium py-2">
                    {editedAnswer}
                  </p>
                  {pendingSuggestion?.answer && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        {pendingSuggestion.answer}
                      </span>
                      <button
                        onClick={() => handleAcceptSuggestion("answer")}
                        className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                        title="Accept"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRejectSuggestion("answer")}
                        className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        title="Reject"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Accepted alternatives field */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                Accepted alternatives (comma-separated)
              </label>
              {mode === "manual" ? (
                <input
                  type="text"
                  value={editedAccepted}
                  onChange={(e) => setEditedAccepted(e.target.value)}
                  placeholder="variant1, variant2..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-slate-600 dark:text-slate-300 text-sm py-2">
                    {editedAccepted || "(none)"}
                  </p>
                  {pendingSuggestion?.accepted && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                      <span className="text-sm text-purple-700 dark:text-purple-300">
                        {pendingSuggestion.accepted.join(", ")}
                      </span>
                      <button
                        onClick={() => handleAcceptSuggestion("accepted")}
                        className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                        title="Accept"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRejectSuggestion("accepted")}
                        className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        title="Reject"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Audio section */}
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                Audio
              </label>
              <div className="flex items-center gap-2">
                {audioPath ? (
                  <button
                    onClick={handlePlayAudio}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    {isPlayingAudio ? (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                        Stop
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Play
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400 py-2">
                    No audio generated
                  </span>
                )}
                <button
                  onClick={handleRegenerateAudio}
                  disabled={isGeneratingAudio}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-colors"
                >
                  {isGeneratingAudio ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {audioPath ? "Regenerate" : "Generate"} Audio
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Chat area (only in AI mode) */}
        {mode === "ai" && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[150px] max-h-[250px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
              ) : thread?.messages.length === 0 ? (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">
                  <p>Ask the AI to help refine this phrase:</p>
                  <ul className="mt-2 space-y-1">
                    <li>"Make this more casual"</li>
                    <li>"Add alternative forms"</li>
                    <li>"Is this grammatically correct?"</li>
                  </ul>
                </div>
              ) : (
                thread?.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
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
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Input area */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask AI to refine this phrase..."
                  disabled={isLoading || isSending}
                  className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 disabled:opacity-50 text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={!userInput.trim() || isLoading || isSending}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Error display */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Footer with actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between">
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isAccepting}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isAccepting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Saving...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
