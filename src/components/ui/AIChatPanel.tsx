import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { Spinner } from "./Spinner";
import { SendIcon } from "../icons";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AIChatPanelProps {
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isLoading?: boolean;
  isSending?: boolean;
  placeholder?: string;
  /** Color variant for send button and typing indicator */
  variant?: "blue" | "purple" | "amber";
  /** Custom content to render after each assistant message */
  renderMessageExtra?: (message: ChatMessage, index: number) => React.ReactNode;
  /** Use textarea instead of input */
  multiline?: boolean;
  className?: string;
  messagesClassName?: string;
}

const buttonVariants = {
  blue: "bg-blue-500 hover:bg-blue-600",
  purple: "bg-purple-500 hover:bg-purple-600",
  amber: "bg-amber-500 hover:bg-amber-600",
};

const spinnerVariants = {
  blue: "border-blue-500",
  purple: "border-purple-500",
  amber: "border-amber-500",
};

export function AIChatPanel({
  messages,
  inputValue,
  onInputChange,
  onSend,
  isLoading = false,
  isSending = false,
  placeholder = "Type a message...",
  variant = "blue",
  renderMessageExtra,
  multiline = false,
  className,
  messagesClassName,
}: AIChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Messages area */}
      <div className={cn("flex-1 overflow-y-auto p-4 space-y-3", messagesClassName)}>
        {messages.map((msg, index) => (
          <div
            key={msg.id}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl",
                msg.role === "user"
                  ? "bg-blue-500 text-white px-4 py-2"
                  : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100"
              )}
            >
              <div className={cn(msg.role === "assistant" && "px-4 py-2")}>
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              </div>
              {msg.role === "assistant" && renderMessageExtra?.(msg, index)}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-2">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <div
                  className={cn(
                    "animate-spin rounded-full h-4 w-4 border-b-2",
                    spinnerVariants[variant]
                  )}
                />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          {multiline ? (
            <textarea
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isSending}
              rows={2}
              className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 resize-none disabled:opacity-50 text-sm"
            />
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isSending}
              className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 disabled:opacity-50 text-sm"
            />
          )}
          <button
            onClick={onSend}
            disabled={!inputValue.trim() || isSending}
            className={cn(
              "px-4 py-2 text-white rounded-lg transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              buttonVariants[variant],
              multiline && "self-end"
            )}
          >
            <SendIcon size="sm" />
          </button>
        </div>
      </div>
    </div>
  );
}
