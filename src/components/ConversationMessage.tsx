import type { ChatMessage } from "../types";

interface ConversationMessageProps {
  message: ChatMessage;
  onDelete?: (messageId: string) => void;
  onPlay?: () => void;
  isPlaying?: boolean;
  isLoading?: boolean;
}

export function ConversationMessage({
  message,
  onDelete,
  onPlay,
  isPlaying,
  isLoading,
}: ConversationMessageProps) {
  const isUser = message.role === "user";

  // User messages: Polish input (muted styling)
  if (isUser) {
    return (
      <div className="flex justify-end mb-4 group">
        <div className="relative max-w-[80%] rounded-2xl px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          {onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-slate-400 dark:bg-slate-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500 dark:hover:bg-red-500"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Assistant messages: German translation
  return (
    <div className="flex justify-start mb-4 group">
      <div className="relative max-w-[85%] rounded-2xl px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
        {onDelete && (
          <button
            onClick={() => onDelete(message.id)}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-400 dark:bg-slate-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500 dark:hover:bg-red-500"
            title="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="flex items-start gap-2">
          <p className="whitespace-pre-wrap text-base font-medium text-slate-800 dark:text-slate-100 flex-1">
            {message.content}
          </p>
          {onPlay && (
            <button
              onClick={onPlay}
              disabled={isLoading}
              className={`
                flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors
                ${isPlaying
                  ? "bg-blue-500 text-white"
                  : "bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400"
                }
                disabled:opacity-50
              `}
              title={isPlaying ? "Stop" : "Play"}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
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
          )}
        </div>
      </div>
    </div>
  );
}
