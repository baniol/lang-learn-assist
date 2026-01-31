import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Conversation, ViewType } from "../types";

interface DashboardViewProps {
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await invoke<Conversation[]>("get_conversations");
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateConversation = async () => {
    const now = new Date();
    const title = `Conversation ${now.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;

    try {
      const conversation = await invoke<Conversation>("create_conversation", {
        request: { title, subject: "" },
      });
      onNavigate("conversation", { conversationId: conversation.id });
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const handleDeleteClick = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    try {
      await invoke("delete_conversation", { id: deleteConfirmId });
      setConversations((prev) => prev.filter((c) => c.id !== deleteConfirmId));
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "finalized":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
      case "archived":
        return "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400";
      default:
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Conversations
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Practice German through realistic conversations
          </p>
        </div>
        <button
          onClick={handleCreateConversation}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Conversation
        </button>
      </div>

      {/* Conversations List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
            No conversations yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Start a new conversation to practice your German
          </p>
          <button
            onClick={handleCreateConversation}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Start your first conversation
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() => onNavigate("conversation", { conversationId: conversation.id })}
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 dark:text-white">
                      {conversation.title}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadge(conversation.status)}`}>
                      {conversation.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {conversation.subject}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    {formatDate(conversation.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteClick(conversation.id, e)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Delete conversation?
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              This will permanently delete this conversation and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
