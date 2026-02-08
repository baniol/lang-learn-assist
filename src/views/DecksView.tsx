import { useState } from "react";
import { getDecks, createDeck, deleteDeck, importDeck } from "../lib/decks";
import { Button, Spinner, ConfirmDialog } from "../components/ui";
import { EmptyState } from "../components/shared";
import { PlusIcon, ArchiveIcon, UploadIcon } from "../components/icons";
import { DeckCard, CreateDeckDialog, ImportDeckDialog } from "../components/decks";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { useQuery, useMutation } from "../hooks";
import type { ViewType, CreateDeckRequest, DeckImportData } from "../types";

interface DecksViewProps {
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function DecksView({ onNavigate }: DecksViewProps) {
  const { settings } = useSettings();
  const toast = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Fetch decks
  const {
    data: decks,
    isLoading,
    refetch,
  } = useQuery(
    () => getDecks(settings?.targetLanguage),
    [settings?.targetLanguage],
    {
      onError: (err) => toast.error(`Failed to load decks: ${err.message}`),
    }
  );

  // Create deck mutation
  const createMutation = useMutation(
    (request: CreateDeckRequest) => createDeck(request),
    {
      onSuccess: () => {
        setShowCreateDialog(false);
        refetch();
        toast.success("Deck created");
      },
      onError: (err) => {
        toast.error(`Failed to create deck: ${err.message}`);
      },
    }
  );

  // Delete mutation
  const deleteMutation = useMutation(
    (id: number) => deleteDeck(id),
    {
      onSuccess: () => {
        setDeleteConfirm(null);
        refetch();
        toast.success("Deck deleted");
      },
      onError: (err) => {
        setDeleteConfirm(null);
        toast.error(`Failed to delete deck: ${err.message}`);
      },
    }
  );

  // Import mutation
  const importMutation = useMutation(
    (data: DeckImportData) => importDeck(data),
    {
      onSuccess: (result) => {
        setShowImportDialog(false);
        refetch();
        toast.success(result.message);
      },
      onError: (err) => {
        toast.error(`Failed to import deck: ${err.message}`);
      },
    }
  );

  const handleStudy = (deckId: number) => {
    onNavigate("deck-study", { deckId });
  };

  const handleView = (deckId: number) => {
    onNavigate("deck-detail", { deckId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              Decks
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Organize new phrases for learning before they graduate to SRS
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowImportDialog(true)}>
              <UploadIcon size="sm" />
              Import
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <PlusIcon size="sm" />
              New Deck
            </Button>
          </div>
        </div>
      </div>

      {/* Decks List */}
      <div className="flex-1 overflow-y-auto p-6">
        {!decks || decks.length === 0 ? (
          <EmptyState
            icon={
              <ArchiveIcon
                size="xl"
                className="text-slate-300 dark:text-slate-600"
              />
            }
            title="No decks yet"
            description="Create a deck to organize new phrases for focused learning."
            action={{
              label: "Create your first deck",
              onClick: () => setShowCreateDialog(true),
            }}
          />
        ) : (
          <div className="grid gap-4">
            {decks.map((deck) => (
              <DeckCard
                key={deck.deck.id}
                deck={deck}
                onStudy={handleStudy}
                onView={handleView}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <CreateDeckDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={createMutation.mutate}
        isLoading={createMutation.isLoading}
        defaultTargetLanguage={settings?.targetLanguage}
        defaultNativeLanguage={settings?.nativeLanguage}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm !== null && deleteMutation.mutate(deleteConfirm)}
        title="Delete Deck?"
        message="Are you sure you want to delete this deck? Phrases in the deck will be kept but will be unassigned."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isLoading}
      />

      {/* Import Dialog */}
      <ImportDeckDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onSubmit={importMutation.mutate}
        isLoading={importMutation.isLoading}
      />
    </div>
  );
}
