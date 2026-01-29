import type { ChatMessage } from "../types";

interface ConversationMessageProps {
  message: ChatMessage;
  onDelete?: (messageId: string) => void;
}

export function ConversationMessage({
  message,
  onDelete,
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
        <p className="whitespace-pre-wrap text-base font-medium text-slate-800 dark:text-slate-100">
          {message.content}
        </p>
      </div>
    </div>
  );
}
