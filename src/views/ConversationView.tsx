import { useState, useEffect, useRef } from "react";
import { getConversation } from "../api";
import type { Conversation, ChatMessage, ViewType } from "../types";
import { ConversationMessage } from "../components/ConversationMessage";
import { VoiceButton } from "../components/VoiceButton";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useConversation, parseMessages } from "../hooks/useConversation";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { Button, Spinner } from "../components/ui";
import {
  ChevronLeftIcon,
  PlayIcon,
  StopIcon,
  CheckIcon,
  SendIcon,
  CloseIcon,
  MicrophoneIcon,
  EditIcon,
} from "../components/icons";

type InputMode = "text" | "voice";

interface ConversationViewProps {
  conversationId: number;
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function ConversationView({
  conversationId,
  onNavigate,
}: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [pendingVoiceText, setPendingVoiceText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    loadMessages,
    clearError,
    deleteMessage,
  } = useConversation({
    conversation,
  });

  const audioPlayback = useAudioPlayback({
    language: conversation?.targetLanguage,
  });

  const voiceRecording = useVoiceRecording({
    enabled: inputMode === "voice" && conversation?.status === "draft",
    language: conversation?.nativeLanguage || "pl",
    onTranscription: (text) => {
      setVoiceError(null);
      if (inputMode === "voice") {
        setPendingVoiceText((prev) => prev + (prev ? " " : "") + text);
      } else {
        setInputText((prev) => prev + (prev ? " " : "") + text);
      }
    },
    onError: (err) => {
      console.error("Voice error:", err);
      setVoiceError(err);
    },
  });

  useEffect(() => {
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadConversation is stable, only re-run when conversationId changes
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [conversation, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversation = async () => {
    setConversationLoading(true);
    setConversationError(null);
    try {
      const data = await getConversation(conversationId);
      setConversation(data);
    } catch (err) {
      console.error("Failed to load conversation:", err);
      setConversationError(
        err instanceof Error ? err.message : "Failed to load conversation"
      );
    } finally {
      setConversationLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const text = inputText;
    setInputText("");
    await sendMessage(text);
  };

  const handleFinalize = async () => {
    if (!conversation || messages.length === 0) return;
    setIsFinalizing(true);
    onNavigate("conversation-review", { conversationId: conversation.id });
  };

  const handleVoiceSend = async () => {
    if (!pendingVoiceText.trim() || isLoading) return;
    const text = pendingVoiceText;
    setPendingVoiceText("");
    await sendMessage(text);
  };

  const handleClearVoiceText = () => {
    setPendingVoiceText("");
  };

  if (conversationLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (conversationError || !conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-red-600 dark:text-red-400">
          {conversationError || "Conversation not found"}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => onNavigate("dashboard")} variant="ghost">
            <ChevronLeftIcon size="sm" />
            Back
          </Button>
          <Button onClick={loadConversation}>Retry</Button>
        </div>
      </div>
    );
  }

  const isFinalized = conversation.status === "finalized";

  // For finalized conversations, show only German phrases
  const finalMessages: ChatMessage[] = isFinalized
    ? parseMessages(conversation.finalMessagesJson)
    : [];

  // Finalized view - read only, German only
  if (isFinalized) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => onNavigate("dashboard")}
                variant="ghost"
                size="sm"
              >
                <ChevronLeftIcon size="sm" />
              </Button>
              <div>
                <h1 className="font-semibold text-slate-800 dark:text-white">
                  {conversation.title}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(conversation.createdAt).toLocaleDateString(
                    undefined,
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    },
                  )}
                  {" • "}
                  <span className="text-green-600 dark:text-green-400">
                    Completed
                  </span>
                </p>
              </div>
            </div>
            {finalMessages.length > 0 && (
              <Button
                onClick={() =>
                  audioPlayback.isPlaying
                    ? audioPlayback.stop()
                    : audioPlayback.playAll(finalMessages)
                }
                disabled={audioPlayback.isLoading}
                variant={audioPlayback.isPlaying ? "danger" : "secondary"}
              >
                {audioPlayback.isLoading ? (
                  <Spinner size="sm" />
                ) : audioPlayback.isPlaying ? (
                  <StopIcon size="sm" />
                ) : (
                  <PlayIcon size="sm" />
                )}
                {audioPlayback.isPlaying ? "Stop" : "Play All"}
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
          <div className="max-w-2xl mx-auto space-y-3">
            {finalMessages.map((msg, i) => {
              const messageId = msg.id || `final-${i}`;
              const isCurrentPlaying =
                audioPlayback.currentlyPlayingId === messageId &&
                audioPlayback.isPlaying;
              const isCurrentLoading =
                audioPlayback.currentlyPlayingId === messageId &&
                audioPlayback.isLoading;
              return (
                <div
                  key={i}
                  className="px-4 py-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-lg text-slate-800 dark:text-white flex-1">
                      {msg.content}
                    </p>
                    <button
                      onClick={() =>
                        audioPlayback.playMessage(msg.content, messageId, i)
                      }
                      disabled={isCurrentLoading}
                      className={`
                        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors
                        ${
                          isCurrentPlaying
                            ? "bg-blue-500 text-white"
                            : "bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400"
                        }
                        disabled:opacity-50
                      `}
                      title={isCurrentPlaying ? "Stop" : "Play"}
                    >
                      {isCurrentLoading ? (
                        <Spinner size="sm" />
                      ) : isCurrentPlaying ? (
                        <StopIcon size="xs" />
                      ) : (
                        <PlayIcon size="xs" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Draft view - editable
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => onNavigate("dashboard")}
              variant="ghost"
              size="sm"
            >
              <ChevronLeftIcon size="sm" />
            </Button>
            <div>
              <h1 className="font-semibold text-slate-800 dark:text-white">
                {conversation.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(conversation.createdAt).toLocaleDateString(
                  undefined,
                  {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  },
                )}
                {conversation.subject && ` • ${conversation.subject}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.some((m) => m.role === "assistant") && (
              <Button
                onClick={() =>
                  audioPlayback.isPlaying
                    ? audioPlayback.stop()
                    : audioPlayback.playAll(messages)
                }
                disabled={audioPlayback.isLoading}
                variant={audioPlayback.isPlaying ? "danger" : "secondary"}
              >
                {audioPlayback.isLoading ? (
                  <Spinner size="sm" />
                ) : audioPlayback.isPlaying ? (
                  <StopIcon size="sm" />
                ) : (
                  <PlayIcon size="sm" />
                )}
                {audioPlayback.isPlaying ? "Stop" : "Play All"}
              </Button>
            )}
            <Button
              onClick={handleFinalize}
              disabled={messages.length === 0 || isFinalizing}
              variant="success"
            >
              <CheckIcon size="sm" />
              Finish & Extract
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400 mb-2">
              Ask how to say something in German!
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Speak in Polish, e.g., "Jak powiedziec 'dzien dobry'?"
            </p>
          </div>
        ) : (
          <>
            {(() => {
              let assistantIndex = 0;
              return messages.map((message) => {
                const currentAssistantIndex =
                  message.role === "assistant" ? assistantIndex++ : -1;
                return (
                  <ConversationMessage
                    key={message.id}
                    message={message}
                    onDelete={deleteMessage}
                    onPlay={
                      message.role === "assistant"
                        ? () =>
                            audioPlayback.playMessage(
                              message.content,
                              message.id,
                              currentAssistantIndex,
                            )
                        : undefined
                    }
                    isPlaying={
                      audioPlayback.currentlyPlayingId === message.id &&
                      audioPlayback.isPlaying
                    }
                    isLoading={
                      audioPlayback.currentlyPlayingId === message.id &&
                      audioPlayback.isLoading
                    }
                  />
                );
              });
            })()}
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-white dark:bg-slate-700 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-600">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={clearError}
              className="text-red-600 dark:text-red-400"
            >
              <CloseIcon size="xs" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        {/* Mode Toggle */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setInputMode("voice")}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors
              ${
                inputMode === "voice"
                  ? "bg-blue-500 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
              }
            `}
          >
            <MicrophoneIcon size="xs" />
            Voice
          </button>
          <button
            type="button"
            onClick={() => setInputMode("text")}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors
              ${
                inputMode === "text"
                  ? "bg-blue-500 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
              }
            `}
          >
            <EditIcon size="xs" />
            Text
          </button>
        </div>

        {/* Voice Input Mode */}
        {inputMode === "voice" && (
          <div className="space-y-3">
            <div className="flex flex-col items-center justify-center py-4">
              <VoiceButton
                status={voiceRecording.status}
                isAvailable={voiceRecording.isAvailable}
                onPress={voiceRecording.startRecording}
                onRelease={voiceRecording.stopRecording}
                size="lg"
              />

              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                {voiceRecording.status === "recording" ? (
                  <span className="text-red-500 animate-pulse">
                    Recording... Release to stop
                  </span>
                ) : voiceRecording.status === "transcribing" ? (
                  <span className="text-amber-500">Transcribing...</span>
                ) : voiceRecording.isAvailable ? (
                  "Hold Space or click & hold to speak in Polish"
                ) : (
                  <span className="text-red-500">
                    Whisper not available. Check settings.
                  </span>
                )}
              </p>

              {voiceError && (
                <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {voiceError}
                    </p>
                    <button
                      onClick={() => setVoiceError(null)}
                      className="text-red-600 dark:text-red-400 ml-2"
                    >
                      <CloseIcon size="xs" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {pendingVoiceText && (
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <p className="text-slate-800 dark:text-white mb-2">
                  {pendingVoiceText}
                </p>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    onClick={handleClearVoiceText}
                    variant="ghost"
                    size="sm"
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={handleVoiceSend}
                    disabled={isLoading}
                    size="sm"
                  >
                    <SendIcon size="xs" />
                    Send
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Text Input Mode */}
        {inputMode === "text" && (
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Jak powiedziec...? (Type in Polish)"
                disabled={isLoading}
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <Button type="submit" disabled={!inputText.trim() || isLoading}>
              <SendIcon size="sm" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
