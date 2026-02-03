import type { ChatMessage } from "../types";
import { CloseIcon, StopIcon, PlayCircleIcon } from "./icons";

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
              <CloseIcon size="xs" />
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
            <CloseIcon size="xs" />
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
                <StopIcon size="sm" />
              ) : (
                <PlayCircleIcon size="sm" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
