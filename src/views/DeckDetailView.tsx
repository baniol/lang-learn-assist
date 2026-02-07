import { useState } from "react";
import {
  getDeck,
  getDeckPhrases,
  updateDeck,
  deleteDeck,
  assignPhraseToDeck,
} from "../lib/decks";
import { Button, Spinner, ConfirmDialog, Input, Badge } from "../components/ui";
import { EmptyState } from "../components/shared";
import {
  ChevronLeftIcon,
  PlayIcon,
  EditIcon,
  TrashIcon,
  BookIcon,
} from "../components/icons";
import { DeckPhraseList } from "../components/decks";
import { useToast } from "../contexts/ToastContext";
import { useQuery, useMutation } from "../hooks";
import type { ViewType, UpdateDeckRequest } from "../types";

interface DeckDetailViewProps {
  deckId: number;
  onNavigate: (view: ViewType, data?: unknown) => void;
}

export function DeckDetailView({ deckId, onNavigate }: DeckDetailViewProps) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editThreshold, setEditThreshold] = useState(2);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch deck
  const {
    data: deck,
    isLoading: deckLoading,
    refetch: refetchDeck,
  } = useQuery(() => getDeck(deckId), [deckId], {
    onError: (err) => toast.error(`Failed to load deck: ${err.message}`),
    onSuccess: (deck) => {
      setEditName(deck.name);
      setEditDescription(deck.description || "");
      setEditThreshold(deck.graduationThreshold);
    },
  });

  // Fetch phrases
  const {
    data: phrases,
    isLoading: phrasesLoading,
    refetch: refetchPhrases,
  } = useQuery(() => getDeckPhrases(deckId), [deckId], {
    onError: (err) => toast.error(`Failed to load phrases: ${err.message}`),
  });

  // Update deck mutation
  const updateMutation = useMutation(
    (request: UpdateDeckRequest) => updateDeck(deckId, request),
    {
      onSuccess: () => {
        setIsEditing(false);
        refetchDeck();
        toast.success("Deck updated");
      },
      onError: (err) => {
        toast.error(`Failed to update deck: ${err.message}`);
      },
    }
  );

  // Delete deck mutation
  const deleteMutation = useMutation(() => deleteDeck(deckId), {
    onSuccess: () => {
      toast.success("Deck deleted");
      onNavigate("decks");
    },
    onError: (err) => {
      setShowDeleteConfirm(false);
      toast.error(`Failed to delete deck: ${err.message}`);
    },
  });

  // Remove phrase from deck mutation
  const removeMutation = useMutation(
    (phraseId: number) => assignPhraseToDeck(phraseId, null),
    {
      onSuccess: () => {
        refetchPhrases();
        toast.success("Phrase removed from deck");
      },
      onError: (err) => {
        toast.error(`Failed to remove phrase: ${err.message}`);
      },
    }
  );

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      toast.error("Name is required");
      return;
    }
    updateMutation.mutate({
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      graduationThreshold: editThreshold,
    });
  };

  const handleCancelEdit = () => {
    if (deck) {
      setEditName(deck.name);
      setEditDescription(deck.description || "");
      setEditThreshold(deck.graduationThreshold);
    }
    setIsEditing(false);
  };

  const isLoading = deckLoading || phrasesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500 dark:text-slate-400">Deck not found</div>
      </div>
    );
  }

  const learningCount =
    phrases?.filter((p) => !p.progress?.inSrsPool).length ?? 0;
  const graduatedCount =
    phrases?.filter((p) => p.progress?.inSrsPool).length ?? 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("decks")}
          >
            <ChevronLeftIcon size="sm" />
            Back
          </Button>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Deck name"
              className="text-xl font-bold"
            />
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
            />
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={10}
                value={editThreshold}
                onChange={(e) =>
                  setEditThreshold(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-24"
              />
              <span className="text-sm text-slate-500 dark:text-slate-400">
                correct answers to graduate
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveEdit}
                disabled={updateMutation.isLoading}
              >
                {updateMutation.isLoading ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={updateMutation.isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                {deck.name}
              </h1>
              {deck.description && (
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {deck.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-3">
                <Badge variant="default" size="sm">
                  {phrases?.length ?? 0} phrases
                </Badge>
                {learningCount > 0 && (
                  <Badge variant="warning" size="sm">
                    {learningCount} learning
                  </Badge>
                )}
                {graduatedCount > 0 && (
                  <Badge variant="success" size="sm">
                    {graduatedCount} graduated
                  </Badge>
                )}
                <Badge variant="info" size="sm">
                  {deck.graduationThreshold} to graduate
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {learningCount > 0 && (
                <Button
                  onClick={() => onNavigate("deck-study", { deckId })}
                >
                  <PlayIcon size="sm" />
                  Study
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                title="Edit deck"
              >
                <EditIcon size="sm" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                title="Delete deck"
              >
                <TrashIcon size="sm" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Phrases List */}
      <div className="flex-1 overflow-y-auto">
        {!phrases || phrases.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={
                <BookIcon
                  size="xl"
                  className="text-slate-300 dark:text-slate-600"
                />
              }
              title="No phrases in this deck"
              description="Add phrases from the Phrase Library to start learning."
              action={{
                label: "Go to Phrase Library",
                onClick: () => onNavigate("phrase-library"),
              }}
            />
          </div>
        ) : (
          <DeckPhraseList
            phrases={phrases}
            graduationThreshold={deck.graduationThreshold}
            onRemovePhrase={removeMutation.mutate}
            isRemoving={removeMutation.isLoading}
          />
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Deck?"
        message="Are you sure you want to delete this deck? Phrases will be kept but unassigned from the deck."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
}
