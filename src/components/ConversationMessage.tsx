import type { ChatMessage } from "../types";

interface ConversationMessageProps {
  message: ChatMessage;
}

export function ConversationMessage({ message }: ConversationMessageProps) {
  const isUser = message.role === "user" || message.role === "meta";
  const isMeta = message.isMetaQuestion || message.role === "meta";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-3
          ${
            isMeta
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-800"
              : isUser
              ? "bg-blue-500 text-white"
              : "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600"
          }
        `}
      >
        {isMeta && (
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
            META QUESTION
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.content.replace(/^\[META\]\s*/, "")}</p>
      </div>
    </div>
  );
}
