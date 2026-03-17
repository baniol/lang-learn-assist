import { useState, useEffect, useCallback, useRef } from "react";
import { getMaterial } from "../lib/materials";
import {
  createPracticeSession,
  updatePracticeSession,
  practiceSendMessage,
} from "../lib/practice";
import { createPhrase } from "../api";
import { AIChatPanel } from "../components/ui";
import { VoiceButton } from "../components/VoiceButton";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useSettings } from "../contexts/SettingsContext";
import { ChevronLeftIcon, CheckIcon, CloseIcon } from "../components/icons";
import { cn } from "../lib/utils";
import type {
  ViewType,
  Material,
  TextSegment,
  PracticeMode,
  PracticeSession,
  PracticeMessage,
  SuggestedPhrase,
  CreatePhraseRequest,
} from "../types";

interface MaterialPracticeViewProps {
  materialId: number;
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function MaterialPracticeView({
  materialId,
  onNavigate,
}: MaterialPracticeViewProps) {
  const { settings } = useSettings();
  const [material, setMaterial] = useState<Material | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<PracticeMode>("free");
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [messages, setMessages] = useState<PracticeMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingPhrases, setPendingPhrases] = useState<SuggestedPhrase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const exerciseStartedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load material
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const mat = await getMaterial(materialId);
        if (mountedRef.current) {
          setMaterial(mat);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(`Failed to load material: ${err}`);
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };
    load();
  }, [materialId]);

  // Voice recording
  const handleTranscription = useCallback((text: string) => {
    setInputValue((prev) => (prev ? prev + " " + text : text));
  }, []);

  const { status: voiceStatus, isAvailable: voiceAvailable, startRecording, stopRecording } =
    useVoiceRecording({
      enabled: true,
      language: material?.targetLanguage || settings?.targetLanguage,
      onTranscription: handleTranscription,
    });

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isSending || !material) return;

    setIsSending(true);
    setError(null);
    const userText = inputValue.trim();
    setInputValue("");

    try {
      // Create session on first message
      let currentSession = session;
      if (!currentSession) {
        currentSession = await createPracticeSession(materialId, mode);
        if (mountedRef.current) {
          setSession(currentSession);
        }
      }

      // Add user message
      const userMessage: PracticeMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userText,
      };
      const updatedMessages = [...messages, userMessage];
      if (mountedRef.current) {
        setMessages(updatedMessages);
      }

      // Send to LLM
      const response = await practiceSendMessage(
        materialId,
        mode,
        userText,
        messages,
        material.targetLanguage,
        material.nativeLanguage
      );

      if (!mountedRef.current) return;

      // Add assistant message (include feedback for exercise mode)
      let assistantContent = response.reply;
      if (response.feedback && mode === "exercise") {
        const feedbackEmoji =
          response.feedback === "correct"
            ? "\u2705"
            : response.feedback === "partial"
              ? "\u26a0\ufe0f"
              : "\u274c";
        assistantContent = `${feedbackEmoji} ${assistantContent}`;
      }

      const assistantMessage: PracticeMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantContent,
      };
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      // Accumulate suggested phrases
      const newPhrases = [...pendingPhrases, ...response.phrases];
      setPendingPhrases(newPhrases);

      // Persist session
      await updatePracticeSession(
        currentSession.id,
        finalMessages,
        newPhrases.length > 0 ? newPhrases : null
      );
    } catch (err) {
      if (mountedRef.current) {
        setError(
          `Failed to get response: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } finally {
      if (mountedRef.current) {
        setIsSending(false);
      }
    }
  }, [inputValue, isSending, material, session, materialId, mode, messages, pendingPhrases]);

  // Auto-start exercise mode
  useEffect(() => {
    if (
      mode === "exercise" &&
      material &&
      messages.length === 0 &&
      !isSending &&
      !exerciseStartedRef.current
    ) {
      exerciseStartedRef.current = true;
      setInputValue("Start the exercise");
      // Use setTimeout to let the state update, then trigger send
      setTimeout(() => {
        const sendExercise = async () => {
          setIsSending(true);
          setError(null);
          try {
            let currentSession = session;
            if (!currentSession) {
              currentSession = await createPracticeSession(materialId, mode);
              if (mountedRef.current) {
                setSession(currentSession);
              }
            }

            const userMessage: PracticeMessage = {
              id: crypto.randomUUID(),
              role: "user",
              content: "Start the exercise",
            };

            const response = await practiceSendMessage(
              materialId,
              mode,
              "Start the exercise",
              [],
              material.targetLanguage,
              material.nativeLanguage
            );

            if (!mountedRef.current) return;

            const assistantMessage: PracticeMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: response.reply,
            };
            const finalMessages = [userMessage, assistantMessage];
            setMessages(finalMessages);
            setInputValue("");

            if (response.phrases.length > 0) {
              setPendingPhrases(response.phrases);
            }

            await updatePracticeSession(
              currentSession.id,
              finalMessages,
              response.phrases.length > 0 ? response.phrases : null
            );
          } catch (err) {
            if (mountedRef.current) {
              setError(
                `Failed to start exercise: ${err instanceof Error ? err.message : String(err)}`
              );
            }
          } finally {
            if (mountedRef.current) {
              setIsSending(false);
            }
          }
        };
        sendExercise();
      }, 0);
    }
  }, [mode, material, messages.length, isSending, session, materialId]);

  const handleModeChange = (newMode: PracticeMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setSession(null);
    setMessages([]);
    setPendingPhrases([]);
    setError(null);
    setInputValue("");
    exerciseStartedRef.current = false;
  };

  const handleAcceptPhrase = async (phrase: SuggestedPhrase, index: number) => {
    if (!material) return;
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

      if (session) {
        await updatePracticeSession(
          session.id,
          messages,
          updated.length > 0 ? updated : null
        );
      }
    } catch (err) {
      setError(`Failed to save phrase: ${err}`);
    }
  };

  const handleRejectPhrase = async (index: number) => {
    const updated = pendingPhrases.filter((_, i) => i !== index);
    setPendingPhrases(updated);

    if (session) {
      try {
        await updatePracticeSession(
          session.id,
          messages,
          updated.length > 0 ? updated : null
        );
      } catch (err) {
        console.error("Failed to update session:", err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!material) {
    return (
      <div className="p-4 text-red-500">Material not found</div>
    );
  }

  const segments: TextSegment[] = material.segmentsJson
    ? JSON.parse(material.segmentsJson)
    : [];

  if (segments.length === 0) {
    return (
      <div className="p-4">
        <button
          onClick={() => onNavigate("material-review", { materialId })}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
        >
          <ChevronLeftIcon size="sm" />
          <span>Back</span>
        </button>
        <p className="text-slate-500">
          This material has no processed segments yet. Please process it first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate("material-review", { materialId })}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <ChevronLeftIcon size="sm" />
              <span>Back</span>
            </button>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white truncate max-w-md">
              {material.title}
            </h2>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => handleModeChange("free")}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                mode === "free"
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              Free Chat
            </button>
            <button
              onClick={() => handleModeChange("exercise")}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                mode === "exercise"
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              Exercise
            </button>
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
        messages={messages}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={handleSend}
        isSending={isSending}
        placeholder={
          mode === "free"
            ? "Say something in the target language..."
            : "Respond in the target language..."
        }
        variant={mode === "free" ? "blue" : "purple"}
        className="flex-1 min-h-0"
        messagesClassName="min-h-[200px]"
        renderInputExtra={() => (
          <VoiceButton
            status={voiceStatus}
            isAvailable={voiceAvailable}
            onPress={startRecording}
            onRelease={stopRecording}
            size="sm"
          />
        )}
      />

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
