import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Conversation, ViewType } from "../types";
import { ConversationMessage } from "../components/ConversationMessage";
import { VoiceButton } from "../components/VoiceButton";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useConversation } from "../hooks/useConversation";

type InputMode = "text" | "voice";

interface ConversationViewProps {
  conversationId: number;
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function ConversationView({ conversationId, onNavigate }: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState("");
  const [isMetaMode, setIsMetaMode] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [pendingVoiceText, setPendingVoiceText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, error, sendMessage, loadMessages, clearError } = useConversation({
    conversation,
  });

  const voiceRecording = useVoiceRecording({
    enabled: inputMode === "voice",
    language: conversation?.targetLanguage || "de",
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

  // Note: Alt+Space keyboard handling is done in the useVoiceRecording hook

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
    await sendMessage(text, isMetaMode);
    setIsMetaMode(false);
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
    await sendMessage(text, isMetaMode);
    setIsMetaMode(false);
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
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {conversation.subject}
              </p>
            </div>
          </div>
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400 mb-2">
              Start the conversation in German!
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Use [META] or toggle Meta mode to ask questions about the language
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ConversationMessage key={message.id} message={message} />
            ))}
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

          {/* Meta toggle */}
          <div className="ml-4 border-l border-slate-200 dark:border-slate-600 pl-4">
            <button
              type="button"
              onClick={() => setIsMetaMode(!isMetaMode)}
              className={`
                px-2 py-1 text-xs font-medium rounded transition-colors
                ${isMetaMode
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                }
              `}
            >
              META
            </button>
          </div>
        </div>

        {/* Text Input Mode */}
        {inputMode === "text" && (
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isMetaMode ? "Ask about German (in Polish)..." : "Type in German..."}
                disabled={isLoading}
                className={`
                  w-full px-4 py-3 border rounded-xl bg-slate-50 dark:bg-slate-900
                  text-slate-800 dark:text-white placeholder-slate-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:opacity-50
                  ${isMetaMode ? "border-amber-400" : "border-slate-200 dark:border-slate-700"}
                `}
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

        {/* Voice Input Mode */}
        {inputMode === "voice" && (
          <div className="space-y-3">
            {/* Voice recording area */}
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
                  "Hold Option+Space or click & hold the button"
                ) : (
                  <span className="text-red-500">Whisper not available. Check settings.</span>
                )}
              </p>

              {/* Voice error display */}
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

            {/* Transcribed text preview and send */}
            {pendingVoiceText && (
              <div className={`
                p-3 rounded-xl border bg-slate-50 dark:bg-slate-900
                ${isMetaMode ? "border-amber-400" : "border-slate-200 dark:border-slate-700"}
              `}>
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
      </div>
    </div>
  );
}
