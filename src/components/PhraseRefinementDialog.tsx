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
import { AIChatPanel } from "./ui";
import {
  CloseIcon,
  CheckIcon,
  PlayIcon,
  PauseIcon,
  RefreshIcon,
  SparklesIcon,
} from "./icons";

type EditMode = "ai" | "manual";

interface PhraseRefinementDialogProps {
  phrase: Phrase;
  onClose: () => void;
  onAccept: (
    prompt: string,
    answer: string,
    accepted: string[],
  ) => Promise<void>;
  onAudioRegenerated?: (audioPath: string) => void;
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

  // Audio state
  const [audioPath, setAudioPath] = useState<string | null>(phrase.audioPath);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pending AI suggestions
  const [pendingSuggestion, setPendingSuggestion] =
    useState<RefinePhraseSuggestion | null>(null);

  // Edited values
  const [editedPrompt, setEditedPrompt] = useState(phrase.prompt);
  const [editedAnswer, setEditedAnswer] = useState(phrase.answer);
  const [editedAccepted, setEditedAccepted] = useState(
    phrase.accepted.join(", "),
  );

  useEffect(() => {
    if (mode === "ai") {
      loadOrCreateThread();
    }
  }, [phrase.id, mode]);

  useEffect(() => {
    if (
      initialMessage &&
      thread &&
      !initialMessageSent &&
      !isLoading &&
      mode === "ai"
    ) {
      setInitialMessageSent(true);
      setUserInput(initialMessage);
      setTimeout(() => {
        handleSendMessage(initialMessage);
      }, 100);
    }
  }, [initialMessage, thread, initialMessageSent, isLoading, mode]);

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

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || userInput.trim();
    if (!text || !thread || isSending) return;

    if (!messageText) setUserInput("");
    setIsSending(true);
    setError(null);

    const userMessage: PhraseThreadMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    const updatedMessages = [...thread.messages, userMessage];
    setThread({ ...thread, messages: updatedMessages });

    try {
      const currentPhrase: Phrase = {
        ...phrase,
        prompt: editedPrompt,
        answer: editedAnswer,
        accepted: editedAccepted
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const suggestion = await refinePhrase(
        currentPhrase,
        thread.messages,
        text,
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
        null,
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

  const handleAcceptSuggestion = (field: "prompt" | "answer" | "accepted") => {
    if (!pendingSuggestion) return;

    if (field === "prompt" && pendingSuggestion.prompt) {
      setEditedPrompt(pendingSuggestion.prompt);
      setPendingSuggestion((prev) => (prev ? { ...prev, prompt: null } : null));
    } else if (field === "answer" && pendingSuggestion.answer) {
      setEditedAnswer(pendingSuggestion.answer);
      setPendingSuggestion((prev) => (prev ? { ...prev, answer: null } : null));
    } else if (field === "accepted" && pendingSuggestion.accepted) {
      setEditedAccepted(pendingSuggestion.accepted.join(", "));
      setPendingSuggestion((prev) =>
        prev ? { ...prev, accepted: null } : null,
      );
    }
  };

  const handleRejectSuggestion = (field: "prompt" | "answer" | "accepted") => {
    if (!pendingSuggestion) return;
    setPendingSuggestion((prev) => (prev ? { ...prev, [field]: null } : null));
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

      await onAccept(editedPrompt, editedAnswer, finalAccepted);

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
      const newPath = await generateTts(
        editedAnswer,
        phrase.id,
        undefined,
        phrase.targetLanguage,
      );
      setAudioPath(newPath);

      await invoke("update_phrase_audio", {
        id: phrase.id,
        audioPath: newPath,
      });

      onAudioRegenerated?.(newPath);
    } catch (err) {
      console.error("Failed to regenerate audio:", err);
      setError(`Failed to regenerate audio: ${err}`);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

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
              <CloseIcon size="sm" />
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
              <SparklesIcon size="sm" />
              AI Assistant
            </button>
          </div>
        </div>

        {/* Phrase fields */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
          <div className="space-y-4">
            {/* Prompt field */}
            <FieldEditor
              label="Prompt (native language)"
              value={editedPrompt}
              onChange={setEditedPrompt}
              isManualMode={mode === "manual"}
              suggestion={pendingSuggestion?.prompt}
              onAccept={() => handleAcceptSuggestion("prompt")}
              onReject={() => handleRejectSuggestion("prompt")}
            />

            {/* Answer field */}
            <FieldEditor
              label="Answer (target language)"
              value={editedAnswer}
              onChange={setEditedAnswer}
              isManualMode={mode === "manual"}
              suggestion={pendingSuggestion?.answer}
              onAccept={() => handleAcceptSuggestion("answer")}
              onReject={() => handleRejectSuggestion("answer")}
              bold
            />

            {/* Accepted alternatives */}
            <FieldEditor
              label="Accepted alternatives (comma-separated)"
              value={editedAccepted}
              onChange={setEditedAccepted}
              isManualMode={mode === "manual"}
              suggestion={pendingSuggestion?.accepted?.join(", ")}
              onAccept={() => handleAcceptSuggestion("accepted")}
              onReject={() => handleRejectSuggestion("accepted")}
              placeholder="variant1, variant2..."
              small
            />

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
                        <PauseIcon size="sm" /> Stop
                      </>
                    ) : (
                      <>
                        <PlayIcon size="sm" /> Play
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400 py-2">
                    No audio
                  </span>
                )}
                <button
                  onClick={handleRegenerateAudio}
                  disabled={isGeneratingAudio}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-colors"
                >
                  {isGeneratingAudio ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />{" "}
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshIcon size="sm" />{" "}
                      {audioPath ? "Regenerate" : "Generate"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Chat (only in AI mode) */}
        {mode === "ai" && (
          <AIChatPanel
            messages={thread?.messages || []}
            inputValue={userInput}
            onInputChange={setUserInput}
            onSend={() => handleSendMessage()}
            isLoading={isLoading}
            isSending={isSending}
            placeholder="Ask AI to refine this phrase..."
            variant="purple"
            className="flex-1 min-h-[200px] max-h-[300px]"
            messagesClassName="min-h-[120px]"
          />
        )}

        {/* Error display */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Footer */}
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
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />{" "}
                Saving...
              </>
            ) : (
              <>
                <CheckIcon size="sm" /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Field editor component for the phrase fields
interface FieldEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isManualMode: boolean;
  suggestion?: string | null;
  onAccept: () => void;
  onReject: () => void;
  placeholder?: string;
  bold?: boolean;
  small?: boolean;
}

function FieldEditor({
  label,
  value,
  onChange,
  isManualMode,
  suggestion,
  onAccept,
  onReject,
  placeholder,
  bold,
  small,
}: FieldEditorProps) {
  const textClass = bold
    ? "text-slate-800 dark:text-white font-medium"
    : small
      ? "text-slate-600 dark:text-slate-300 text-sm"
      : "text-slate-700 dark:text-slate-200";

  return (
    <div>
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
        {label}
      </label>
      {isManualMode ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 ${textClass}`}
        />
      ) : (
        <div className="flex items-center gap-2">
          <p className={`flex-1 py-2 ${textClass}`}>{value || "(empty)"}</p>
          {suggestion && (
            <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <span
                className={`text-sm text-purple-700 dark:text-purple-300 ${bold ? "font-medium" : ""}`}
              >
                {suggestion}
              </span>
              <button
                onClick={onAccept}
                className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                title="Accept"
              >
                <CheckIcon size="xs" />
              </button>
              <button
                onClick={onReject}
                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                title="Reject"
              >
                <CloseIcon size="xs" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
