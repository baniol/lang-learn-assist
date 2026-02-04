import { useState, useCallback } from "react";
import { Button, Spinner, Badge, ConfirmDialog } from "../components/ui";
import { EmptyState } from "../components/shared";
import { PlusIcon, CloseIcon, ChatIcon } from "../components/icons";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { useQuery, useMutation } from "../hooks";
import {
  getConversations,
  createConversation,
  deleteConversation,
} from "../api";
import type { ViewType } from "../types";
import { LANGUAGE_OPTIONS } from "../types";

interface DashboardViewProps {
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { settings } = useSettings();
  const toast = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Fetch conversations
  const {
    data: conversations,
    isLoading,
    refetch,
  } = useQuery(
    () => getConversations({ targetLanguage: settings?.targetLanguage }),
    [settings?.targetLanguage],
    {
      onError: (err) => toast.error(`Failed to load conversations: ${err.message}`),
    }
  );

  // Create conversation mutation
  const createMutation = useMutation(
    () => createConversation({ title: "New Conversation", subject: "" }),
    {
      onSuccess: (conversation) => {
        onNavigate("conversation", { conversationId: conversation.id });
      },
      onError: (err) => toast.error(`Failed to create conversation: ${err.message}`),
    }
  );

  // Delete conversation mutation
  const deleteMutation = useMutation(
    (id: number) => deleteConversation(id),
    {
      onSuccess: () => {
        setDeleteConfirmId(null);
        refetch();
        toast.success("Conversation deleted");
      },
      onError: (err) => {
        setDeleteConfirmId(null);
        toast.error(`Failed to delete conversation: ${err.message}`);
      },
    }
  );

  const handleDeleteClick = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
    }
  }, [deleteConfirmId, deleteMutation]);

  const getStatusVariant = (status: string): "success" | "default" | "info" => {
    switch (status) {
      case "finalized":
        return "success";
      case "archived":
        return "default";
      default:
        return "info";
    }
  };

  const targetLangName =
    LANGUAGE_OPTIONS.find((l) => l.code === settings?.targetLanguage)?.name ||
    "your target language";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Conversations
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Practice {targetLangName} through realistic conversations
          </p>
        </div>
        <Button
          onClick={() => createMutation.mutate(undefined as never)}
          isLoading={createMutation.isLoading}
        >
          <PlusIcon size="sm" />
          New Conversation
        </Button>
      </div>

      {/* Conversations List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : !conversations || conversations.length === 0 ? (
        <EmptyState
          icon={
            <ChatIcon
              size="xl"
              className="text-slate-300 dark:text-slate-600"
            />
          }
          title="No conversations yet"
          description={`Start a new conversation to practice your ${targetLangName}`}
          action={{
            label: "Start your first conversation",
            onClick: () => createMutation.mutate(undefined as never),
          }}
          className="py-12 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
        />
      ) : (
        <div className="grid gap-4">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              onClick={() =>
                onNavigate("conversation", { conversationId: conversation.id })
              }
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 dark:text-white">
                      {conversation.title}
                    </h3>
                    <Badge
                      variant={getStatusVariant(conversation.status)}
                      size="sm"
                    >
                      {conversation.status}
                    </Badge>
                  </div>
                  {conversation.subject && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {conversation.subject}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => handleDeleteClick(conversation.id, e)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  <CloseIcon size="sm" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete conversation?"
        message="This will permanently delete this conversation and cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
}
