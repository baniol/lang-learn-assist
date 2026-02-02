import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Conversation, ChatMessage, ViewType } from "../types";
import { ConversationMessage } from "../components/ConversationMessage";
import { VoiceButton } from "../components/VoiceButton";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useConversation } from "../hooks/useConversation";
import { useAudioPlayback } from "../hooks/useAudioPlayback";

type InputMode = "text" | "voice";

interface ConversationViewProps {
  conversationId: number;
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function ConversationView({ conversationId, onNavigate }: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [pendingVoiceText, setPendingVoiceText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, error, sendMessage, loadMessages, clearError, deleteMessage } = useConversation({
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
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [conversation, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversation = async () => {
    try {
      const data = await invoke<Conversation>("get_conversation", { id: conversationId });
      setConversation(data);
    } catch (err) {
      console.error("Failed to load conversation:", err);
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

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const isFinalized = conversation.status === "finalized";

  // For finalized conversations, show only German phrases
  const finalMessages: ChatMessage[] = isFinalized && conversation.finalMessagesJson
    ? JSON.parse(conversation.finalMessagesJson)
    : [];

  // Finalized view - read only, German only
  if (isFinalized) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onNavigate("dashboard")}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="font-semibold text-slate-800 dark:text-white">
                  {conversation.title}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(conversation.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {" • "}
                  <span className="text-green-600 dark:text-green-400">Completed</span>
                </p>
              </div>
            </div>
            {finalMessages.length > 0 && (
              <button
                onClick={() => audioPlayback.isPlaying ? audioPlayback.stop() : audioPlayback.playAll(finalMessages)}
                disabled={audioPlayback.isLoading}
                className={`
                  px-4 py-2 rounded-lg transition-colors flex items-center gap-2
                  ${audioPlayback.isPlaying
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {audioPlayback.isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : audioPlayback.isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
                {audioPlayback.isPlaying ? "Stop" : "Play All"}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
          <div className="max-w-2xl mx-auto space-y-3">
            {finalMessages.map((msg, i) => {
              const messageId = msg.id || `final-${i}`;
              const isCurrentPlaying = audioPlayback.currentlyPlayingId === messageId && audioPlayback.isPlaying;
              const isCurrentLoading = audioPlayback.currentlyPlayingId === messageId && audioPlayback.isLoading;
              return (
                <div
                  key={i}
                  className="px-4 py-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-lg text-slate-800 dark:text-white flex-1">{msg.content}</p>
                    <button
                      onClick={() => audioPlayback.playMessage(msg.content, messageId, i)}
                      disabled={isCurrentLoading}
                      className={`
                        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors
                        ${isCurrentPlaying
                          ? "bg-blue-500 text-white"
                          : "bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400"
                        }
                        disabled:opacity-50
                      `}
                      title={isCurrentPlaying ? "Stop" : "Play"}
                    >
                      {isCurrentLoading ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : isCurrentPlaying ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="5" width="4" height="14" rx="1" />
                          <rect x="14" y="5" width="4" height="14" rx="1" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M15.528 8.47l-4.604-2.654A1 1 0 009.5 6.684v5.632a1 1 0 001.424.868l4.604-2.654a1 1 0 000-1.736z" />
                          <path fillRule="evenodd" d="M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12zm11-9a9 9 0 100 18 9 9 0 000-18z" clipRule="evenodd" />
                        </svg>
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
            <button
              onClick={() => onNavigate("dashboard")}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="font-semibold text-slate-800 dark:text-white">
                {conversation.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(conversation.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
                {conversation.subject && ` • ${conversation.subject}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.some((m) => m.role === "assistant") && (
              <button
                onClick={() => audioPlayback.isPlaying ? audioPlayback.stop() : audioPlayback.playAll(messages)}
                disabled={audioPlayback.isLoading}
                className={`
                  px-4 py-2 rounded-lg transition-colors flex items-center gap-2
                  ${audioPlayback.isPlaying
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {audioPlayback.isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : audioPlayback.isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
                {audioPlayback.isPlaying ? "Stop" : "Play All"}
              </button>
            )}
            <button
              onClick={handleFinalize}
              disabled={messages.length === 0 || isFinalizing}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Finish & Extract
            </button>
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
                const currentAssistantIndex = message.role === "assistant" ? assistantIndex++ : -1;
                return (
                  <ConversationMessage
                    key={message.id}
                    message={message}
                    onDelete={deleteMessage}
                    onPlay={message.role === "assistant" ? () => audioPlayback.playMessage(message.content, message.id, currentAssistantIndex) : undefined}
                    isPlaying={audioPlayback.currentlyPlayingId === message.id && audioPlayback.isPlaying}
                    isLoading={audioPlayback.currentlyPlayingId === message.id && audioPlayback.isLoading}
                  />
                );
              });
            })()}
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-white dark:bg-slate-700 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-600">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
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
            <button onClick={clearError} className="text-red-600 dark:text-red-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
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
              ${inputMode === "voice"
                ? "bg-blue-500 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Voice
          </button>
          <button
            type="button"
            onClick={() => setInputMode("text")}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors
              ${inputMode === "text"
                ? "bg-blue-500 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
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
                  <span className="text-red-500 animate-pulse">Recording... Release to stop</span>
                ) : voiceRecording.status === "transcribing" ? (
                  <span className="text-amber-500">Transcribing...</span>
                ) : voiceRecording.isAvailable ? (
                  "Hold Space or click & hold to speak in Polish"
                ) : (
                  <span className="text-red-500">Whisper not available. Check settings.</span>
                )}
              </p>

              {voiceError && (
                <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-red-600 dark:text-red-400">{voiceError}</p>
                    <button
                      onClick={() => setVoiceError(null)}
                      className="text-red-600 dark:text-red-400 ml-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {pendingVoiceText && (
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <p className="text-slate-800 dark:text-white mb-2">{pendingVoiceText}</p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClearVoiceText}
                    className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleVoiceSend}
                    disabled={isLoading}
                    className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send
                  </button>
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
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
