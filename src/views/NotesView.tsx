import { useState } from "react";
import { getNotes, createNote, updateNote, deleteNote } from "../lib/notes";
import { Button, Spinner, ConfirmDialog } from "../components/ui";
import { PlusIcon, NoteIcon, TrashIcon } from "../components/icons";
import { EmptyState } from "../components/shared";
import { useToast } from "../contexts/ToastContext";
import { useQuery, useMutation } from "../hooks";
import type { Note } from "../types";

export function NotesView() {
  const toast = useToast();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Fetch notes
  const {
    data: notes,
    isLoading,
    refetch,
  } = useQuery(() => getNotes(), [], {
    onError: (err) => toast.error(`Failed to load notes: ${err.message}`),
  });

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setEditContent(note.content);
  };

  // Create note mutation
  const createMutation = useMutation(() => createNote({ content: "" }), {
    onSuccess: (newNote) => {
      refetch();
      setSelectedNote(newNote);
      setEditContent("");
    },
    onError: (err) => toast.error(`Failed to create note: ${err.message}`),
  });

  // Save note mutation
  const saveMutation = useMutation(
    ({ id, content }: { id: number; content: string }) =>
      updateNote(id, { content }),
    {
      onSuccess: (updated) => {
        refetch();
        setSelectedNote(updated);
      },
      onError: (err) => toast.error(`Failed to save note: ${err.message}`),
    }
  );

  const handleSaveNote = () => {
    if (!selectedNote || editContent === selectedNote.content) return;
    saveMutation.mutate({ id: selectedNote.id, content: editContent });
  };

  // Delete note mutation
  const deleteMutation = useMutation((id: number) => deleteNote(id), {
    onSuccess: () => {
      setDeleteConfirm(null);
      if (selectedNote?.id === deleteConfirm) {
        setSelectedNote(null);
        setEditContent("");
      }
      refetch();
      toast.success("Note deleted");
    },
    onError: (err) => {
      setDeleteConfirm(null);
      toast.error(`Failed to delete note: ${err.message}`);
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "Z");
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString(undefined, { weekday: "short" });
    } else {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
  };

  const getPreview = (content: string) => {
    const firstLine = content.split("\n")[0];
    return firstLine.length > 50
      ? firstLine.slice(0, 50) + "..."
      : firstLine || "Empty note";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Notes List */}
      <div className="w-80 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-white">
            Notes
          </h1>
          <Button
            onClick={() => createMutation.mutate(undefined as never)}
            isLoading={createMutation.isLoading}
            size="sm"
            title="New note"
          >
            <PlusIcon size="sm" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!notes || notes.length === 0 ? (
            <EmptyState
              icon={
                <NoteIcon
                  size="xl"
                  className="text-slate-300 dark:text-slate-600"
                />
              }
              title="No notes yet"
              description="Click the + button to create one"
              className="p-8"
            />
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    selectedNote?.id === note.id
                      ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500"
                      : ""
                  }`}
                >
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                    {getPreview(note.content)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatDate(note.updatedAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Note Editor */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {saveMutation.isLoading ? "Saving..." : ""}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSaveNote}
                  disabled={saveMutation.isLoading || editContent === selectedNote.content}
                  isLoading={saveMutation.isLoading}
                  size="sm"
                >
                  Save
                </Button>
                <Button
                  onClick={() => setDeleteConfirm(selectedNote.id)}
                  variant="ghost"
                  size="sm"
                  title="Delete note"
                  className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  <TrashIcon size="sm" />
                </Button>
              </div>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onBlur={handleSaveNote}
              placeholder="Write your note..."
              className="flex-1 p-4 resize-none bg-transparent text-slate-800 dark:text-white focus:outline-none"
            />
          </>
        ) : (
          <EmptyState
            icon={
              <NoteIcon
                size="xl"
                className="text-slate-400 dark:text-slate-500"
              />
            }
            title="Select a note or create a new one"
            className="flex-1"
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() =>
          deleteConfirm !== null && deleteMutation.mutate(deleteConfirm)
        }
        title="Delete Note?"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
}
