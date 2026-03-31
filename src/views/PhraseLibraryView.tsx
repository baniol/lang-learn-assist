import { useState, useEffect, useCallback, useRef } from "react";
import { useTTS } from "../hooks/useTTS";
import { PhraseRefinementDialog } from "../components/PhraseRefinementDialog";
import { Button, Spinner, ConfirmDialog } from "../components/ui";
import { EmptyState } from "../components/shared";
import { PlusIcon, BookIcon } from "../components/icons";
import {
  PhraseFilters,
  PhraseListItem,
  AddPhraseDialog,
  type FilterStatus,
  type LanguageFilter,
} from "../components/phrases";
import { useSettings } from "../contexts/SettingsContext";

import { getPhrases, updatePhrase, deletePhrase, toggleStarred, updatePhraseAudio } from "../api";
import { type Phrase } from "../types";

export function PhraseLibraryView() {
  const { settings } = useSettings();
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>("current");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [starredOnly, setStarredOnly] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [refiningPhrase, setRefiningPhrase] = useState<Phrase | null>(null);

  const handleAudioGenerated = useCallback(async (phraseId: number, audioPath: string) => {
    try {
      await updatePhraseAudio(phraseId, audioPath);
      setPhrases((prev) => prev.map((p) => (p.id === phraseId ? { ...p, audioPath } : p)));
    } catch (err) {
      console.error("Failed to save audio path:", err);
    }
  }, []);

  const tts = useTTS({
    enabled: true,
    onError: (err) => console.error("TTS error:", err),
    onAudioGenerated: handleAudioGenerated,
  });

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Load phrases when filters change
  useEffect(() => {
    loadPhrases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filterStatus,
    debouncedSearch,
    languageFilter,
    settings?.targetLanguage,
    selectedTagId,
    starredOnly,
  ]);

  const loadPhrases = async () => {
    setIsLoading(true);
    try {
      let targetLang: string | undefined;
      if (languageFilter === "current" && settings?.targetLanguage) {
        targetLang = settings.targetLanguage;
      } else if (languageFilter !== "all" && languageFilter !== "current") {
        targetLang = languageFilter;
      }

      const data = await getPhrases({
        targetLanguage: targetLang,
        tagId: selectedTagId ?? undefined,
        starredOnly: starredOnly || undefined,
      });

      // Apply client-side filtering for search
      let filtered = data;
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        filtered = filtered.filter(
          (p) => p.prompt.toLowerCase().includes(search) || p.answer.toLowerCase().includes(search)
        );
      }

      setPhrases(filtered);
    } catch (err) {
      console.error("Failed to load phrases:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStar = async (id: number) => {
    try {
      const newStarred = await toggleStarred(id);
      setPhrases((prev) => prev.map((p) => (p.id === id ? { ...p, starred: newStarred } : p)));
    } catch (err) {
      console.error("Failed to toggle starred:", err);
    }
  };

  const handlePlay = useCallback(
    async (phrase: Phrase) => {
      if (tts.isPlaying && playingId === phrase.id) {
        tts.stop();
        setPlayingId(null);
        return;
      }

      setPlayingId(phrase.id);
      try {
        await tts.speak(
          phrase.answer,
          phrase.id,
          phrase.audioPath || undefined,
          phrase.targetLanguage
        );
      } catch (err) {
        console.error("[TTS] Error in handlePlay:", err);
      }
      setPlayingId(null);
    },
    [tts, playingId]
  );

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    try {
      await deletePhrase(deleteConfirmId);
      setPhrases((prev) => prev.filter((p) => p.id !== deleteConfirmId));
    } catch (err) {
      console.error("Failed to delete phrase:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handlePhraseAdded = useCallback(async () => {
    await loadPhrases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefineAccept = async (prompt: string, answer: string, accepted: string[]) => {
    if (!refiningPhrase) return;

    await updatePhrase(refiningPhrase.id, { prompt, answer, accepted, refined: true });

    setPhrases((prev) =>
      prev.map((p) =>
        p.id === refiningPhrase.id ? { ...p, prompt, answer, accepted, refined: true } : p
      )
    );
  };

  const totalPhrases = phrases.length;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header + filters */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Phrase Library</h1>
            <p className="text-slate-500 dark:text-slate-400">{totalPhrases} phrases</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <PlusIcon size="sm" />
            Add Phrase
          </Button>
        </div>

        {/* Filters */}
        <PhraseFilters
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          languageFilter={languageFilter}
          onLanguageFilterChange={setLanguageFilter}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          currentLanguage={settings?.targetLanguage}
          selectedTagId={selectedTagId}
          onTagSelect={setSelectedTagId}
          starredOnly={starredOnly}
          onStarredOnlyChange={setStarredOnly}
        />
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : phrases.length === 0 ? (
          <EmptyState
            icon={<BookIcon size="xl" className="text-slate-300 dark:text-slate-600" />}
            title="No phrases found"
            description={
              searchQuery ? "Try a different search" : "Add phrases from conversations or manually"
            }
            className="py-12 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
            {phrases.map((phrase) => (
              <PhraseListItem
                key={phrase.id}
                item={phrase}
                isPlaying={playingId === phrase.id && tts.isPlaying}
                isLoading={tts.isLoading && playingId === phrase.id}
                onToggleStar={handleToggleStar}
                onPlay={() => handlePlay(phrase)}
                onRefine={() => setRefiningPhrase(phrase)}
                onDelete={() => setDeleteConfirmId(phrase.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Phrase Dialog */}
      <AddPhraseDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdded={handlePhraseAdded}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete phrase?"
        message="This will permanently delete this phrase."
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Phrase Refinement Dialog */}
      {refiningPhrase && (
        <PhraseRefinementDialog
          phrase={refiningPhrase}
          onClose={() => setRefiningPhrase(null)}
          onAccept={handleRefineAccept}
          onAudioRegenerated={(audioPath) => {
            setPhrases((prev) =>
              prev.map((p) => (p.id === refiningPhrase.id ? { ...p, audioPath } : p))
            );
            setRefiningPhrase((prev) => (prev ? { ...prev, audioPath } : null));
          }}
        />
      )}
    </div>
  );
}
