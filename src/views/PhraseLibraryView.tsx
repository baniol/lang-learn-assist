import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTTS } from "../hooks/useTTS";
import { PhraseRefinementDialog } from "../components/PhraseRefinementDialog";
import { Button, Spinner, Dialog, ConfirmDialog } from "../components/ui";
import { EmptyState } from "../components/shared";
import {
  PlusIcon,
  CloseIcon,
  StarIcon,
  PlayIcon,
  PauseIcon,
  BookIcon,
  LightbulbIcon,
  CheckCircleIcon,
  ExcludeIcon,
} from "../components/icons";
import { useSettings } from "../contexts/SettingsContext";
import { LEARNING } from "../lib/constants";
import type {
  PhraseWithProgress,
  CreatePhraseRequest,
  LearningStats,
  Phrase,
  UpdatePhraseRequest,
} from "../types";
import { LANGUAGE_OPTIONS } from "../types";

type FilterStatus = "all" | "new" | "learning" | "learned";
type ExcludedFilter = "active" | "excluded" | "all";
type LanguageFilter = "all" | string;

export function PhraseLibraryView() {
  const { settings } = useSettings();
  const [phrases, setPhrases] = useState<PhraseWithProgress[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [excludedFilter, setExcludedFilter] =
    useState<ExcludedFilter>("active");
  const [languageFilter, setLanguageFilter] =
    useState<LanguageFilter>("current");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [newPhrase, setNewPhrase] = useState<CreatePhraseRequest>({
    prompt: "",
    answer: "",
    accepted: [],
    notes: "",
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [refiningPhrase, setRefiningPhrase] = useState<Phrase | null>(null);

  const handleAudioGenerated = useCallback(
    async (phraseId: number, audioPath: string) => {
      // Save audio path to database
      try {
        await invoke("update_phrase_audio", { id: phraseId, audioPath });
        // Update local state so next play uses cached path
        setPhrases((prev) =>
          prev.map((p) =>
            p.phrase.id === phraseId
              ? { ...p, phrase: { ...p.phrase, audioPath } }
              : p,
          ),
        );
      } catch (err) {
        console.error("Failed to save audio path:", err);
      }
    },
    [],
  );

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

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  // Load phrases when filters change
  useEffect(() => {
    loadPhrases();
  }, [
    showStarredOnly,
    excludedFilter,
    filterStatus,
    debouncedSearch,
    languageFilter,
    settings?.targetLanguage,
  ]);

  const loadStats = async () => {
    try {
      const data = await invoke<LearningStats>("get_learning_stats", {});
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const loadPhrases = async () => {
    setIsLoading(true);
    try {
      // Determine the target language filter value
      let targetLang: string | null = null;
      if (languageFilter === "current" && settings?.targetLanguage) {
        targetLang = settings.targetLanguage;
      } else if (languageFilter !== "all" && languageFilter !== "current") {
        targetLang = languageFilter;
      }

      const data = await invoke<PhraseWithProgress[]>("get_phrases", {
        starredOnly: showStarredOnly || null,
        excludedOnly:
          excludedFilter === "all" ? null : excludedFilter === "excluded",
        targetLanguage: targetLang,
        status: filterStatus !== "all" ? filterStatus : null,
        searchQuery: debouncedSearch || null,
      });
      setPhrases(data);
    } catch (err) {
      console.error("Failed to load phrases:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtering now done on backend
  const filteredPhrases = phrases;

  const handleToggleStar = async (id: number) => {
    try {
      const newStarred = await invoke<boolean>("toggle_starred", { id });
      setPhrases((prev) =>
        prev.map((p) =>
          p.phrase.id === id
            ? { ...p, phrase: { ...p.phrase, starred: newStarred } }
            : p,
        ),
      );
    } catch (err) {
      console.error("Failed to toggle starred:", err);
    }
  };

  const handleToggleExcluded = async (id: number) => {
    try {
      const newExcluded = await invoke<boolean>("toggle_excluded", { id });
      setPhrases((prev) =>
        prev.map((p) =>
          p.phrase.id === id
            ? { ...p, phrase: { ...p.phrase, excluded: newExcluded } }
            : p,
        ),
      );
    } catch (err) {
      console.error("Failed to toggle excluded:", err);
    }
  };

  const handlePlay = useCallback(
    async (phrase: PhraseWithProgress) => {
      console.log(
        "[TTS] handlePlay called for phrase:",
        phrase.phrase.id,
        phrase.phrase.answer,
      );

      if (tts.isPlaying && playingId === phrase.phrase.id) {
        console.log("[TTS] Stopping playback");
        tts.stop();
        setPlayingId(null);
        return;
      }

      setPlayingId(phrase.phrase.id);
      try {
        console.log("[TTS] Calling tts.speak...");
        await tts.speak(
          phrase.phrase.answer,
          phrase.phrase.id,
          phrase.phrase.audioPath || undefined,
          phrase.phrase.targetLanguage,
        );
        console.log("[TTS] speak completed");
      } catch (err) {
        console.error("[TTS] Error in handlePlay:", err);
      }
      setPlayingId(null);
    },
    [tts, playingId],
  );

  const handleDeleteClick = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;

    try {
      await invoke("delete_phrase", { id: deleteConfirmId });
      setPhrases((prev) => prev.filter((p) => p.phrase.id !== deleteConfirmId));
      loadStats(); // Refresh stats after deletion
    } catch (err) {
      console.error("Failed to delete phrase:", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleAddPhrase = async () => {
    if (!newPhrase.prompt.trim() || !newPhrase.answer.trim()) return;

    try {
      await invoke("create_phrase", { request: newPhrase });
      setShowAddDialog(false);
      setNewPhrase({ prompt: "", answer: "", accepted: [], notes: "" });
      refreshStats();
    } catch (err) {
      console.error("Failed to create phrase:", err);
    }
  };

  // Refresh stats after changes
  const refreshStats = async () => {
    await loadStats();
    await loadPhrases();
  };

  const handleRefineAccept = async (
    prompt: string,
    answer: string,
    accepted: string[],
  ) => {
    if (!refiningPhrase) return;

    const request: UpdatePhraseRequest = {
      prompt,
      answer,
      accepted,
    };

    await invoke<Phrase>("update_phrase", { id: refiningPhrase.id, request });

    // Update local state
    setPhrases((prev) =>
      prev.map((p) =>
        p.phrase.id === refiningPhrase.id
          ? { ...p, phrase: { ...p.phrase, prompt, answer, accepted } }
          : p,
      ),
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Phrase Library
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {stats
              ? `${stats.totalPhrases} phrases (${stats.learnedCount} learned, ${stats.learningCount} learning, ${stats.newCount} new)`
              : "Loading..."}
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <PlusIcon size="sm" />
          Add Phrase
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          {(["all", "new", "learning", "learned"] as FilterStatus[]).map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${
                  filterStatus === status
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                }
              `}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ),
          )}
        </div>

        <button
          onClick={() => setShowStarredOnly(!showStarredOnly)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${
              showStarredOnly
                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            }
          `}
        >
          <StarIcon size="xs" filled={showStarredOnly} />
          Starred
        </button>

        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-4">
          {(["active", "excluded", "all"] as ExcludedFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setExcludedFilter(filter)}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${
                  excludedFilter === filter
                    ? filter === "excluded"
                      ? "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200"
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                }
              `}
            >
              {filter === "active"
                ? "Active"
                : filter === "excluded"
                  ? "Excluded"
                  : "All"}
            </button>
          ))}
        </div>

        {/* Language filter */}
        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-4">
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            <option value="current">
              {LANGUAGE_OPTIONS.find((l) => l.code === settings?.targetLanguage)
                ?.name || "Current"}{" "}
              only
            </option>
            <option value="all">All languages</option>
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search phrases..."
            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400"
          />
        </div>
      </div>

      {/* Phrases List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : filteredPhrases.length === 0 ? (
        <EmptyState
          icon={
            <BookIcon
              size="xl"
              className="text-slate-300 dark:text-slate-600"
            />
          }
          title="No phrases found"
          description={
            searchQuery
              ? "Try a different search"
              : "Add phrases from conversations or manually"
          }
          className="py-12 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
          {filteredPhrases.map((item) => {
            const p = item.phrase;
            const progress = item.progress;
            const isLearned = progress && progress.correctStreak >= LEARNING.DEFAULT_REQUIRED_STREAK;
            const isLearning =
              progress && progress.totalAttempts > 0 && !isLearned;

            return (
              <div
                key={p.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
              >
                {/* Star */}
                <button
                  onClick={() => handleToggleStar(p.id)}
                  className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex-shrink-0 ${
                    p.starred
                      ? "text-yellow-500"
                      : "text-slate-300 dark:text-slate-600"
                  }`}
                >
                  <StarIcon size="sm" filled={p.starred} />
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                    {p.prompt}
                  </p>
                  <p className="text-base font-medium text-slate-800 dark:text-white">
                    {p.answer}
                  </p>
                </div>

                {/* Status badge with tooltip */}
                <div className="relative group/status flex-shrink-0">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded cursor-help ${
                      isLearned
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : isLearning
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {isLearned ? "Learned" : isLearning ? "Learning" : "New"}
                  </span>
                  {/* Tooltip */}
                  <div className="absolute right-0 top-full mt-1 z-10 invisible group-hover/status:visible opacity-0 group-hover/status:opacity-100 transition-opacity">
                    <div className="bg-slate-800 dark:bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                      {progress ? (
                        <div className="space-y-1">
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Streak:</span>
                            <span>{progress.correctStreak} correct</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-400">Success:</span>
                            <span>
                              {progress.totalAttempts > 0
                                ? Math.round(
                                    (progress.successCount /
                                      progress.totalAttempts) *
                                      100,
                                  )
                                : 0}
                              % ({progress.successCount}/
                              {progress.totalAttempts})
                            </span>
                          </div>
                          {progress.nextReviewAt && (
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Review:</span>
                              <span>
                                {new Date(
                                  progress.nextReviewAt,
                                ).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          Not yet practiced
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handlePlay(item)}
                    disabled={tts.isLoading && playingId === p.id}
                    className="p-2 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors"
                    title="Play"
                  >
                    {tts.isLoading && playingId === p.id ? (
                      <Spinner size="sm" />
                    ) : playingId === p.id ? (
                      <PauseIcon size="xs" />
                    ) : (
                      <PlayIcon size="xs" />
                    )}
                  </button>
                  <button
                    onClick={() => setRefiningPhrase(p)}
                    className="p-2 rounded text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors opacity-0 group-hover:opacity-100"
                    title="Refine with AI"
                  >
                    <LightbulbIcon size="xs" />
                  </button>
                  <button
                    onClick={() => handleToggleExcluded(p.id)}
                    className={`p-2 rounded transition-colors opacity-0 group-hover:opacity-100 ${
                      p.excluded
                        ? "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
                        : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                    title={
                      p.excluded
                        ? "Include in learning"
                        : "Exclude from learning"
                    }
                  >
                    {p.excluded ? (
                      <CheckCircleIcon size="xs" />
                    ) : (
                      <ExcludeIcon size="xs" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(p.id);
                    }}
                    className="p-2 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <CloseIcon size="xs" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Phrase Dialog */}
      <Dialog
        isOpen={showAddDialog}
        onClose={() => {
          setShowAddDialog(false);
          setNewPhrase({ prompt: "", answer: "", accepted: [], notes: "" });
        }}
        title="Add New Phrase"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Prompt (Polish)
            </label>
            <input
              type="text"
              value={newPhrase.prompt}
              onChange={(e) =>
                setNewPhrase({ ...newPhrase, prompt: e.target.value })
              }
              placeholder="What do you want to say..."
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Answer (German)
            </label>
            <input
              type="text"
              value={newPhrase.answer}
              onChange={(e) =>
                setNewPhrase({ ...newPhrase, answer: e.target.value })
              }
              placeholder="The German translation..."
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Accepted Alternatives (comma-separated)
            </label>
            <input
              type="text"
              value={newPhrase.accepted?.join(", ") || ""}
              onChange={(e) =>
                setNewPhrase({
                  ...newPhrase,
                  accepted: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="variant1, variant2..."
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={newPhrase.notes || ""}
              onChange={(e) =>
                setNewPhrase({ ...newPhrase, notes: e.target.value })
              }
              placeholder="Any helpful notes..."
              rows={2}
              className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={() => {
                setShowAddDialog(false);
                setNewPhrase({
                  prompt: "",
                  answer: "",
                  accepted: [],
                  notes: "",
                });
              }}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPhrase}
              disabled={!newPhrase.prompt.trim() || !newPhrase.answer.trim()}
            >
              Add Phrase
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete phrase?"
        message="This will permanently delete this phrase and its progress."
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
            // Update local state with new audio path
            setPhrases((prev) =>
              prev.map((p) =>
                p.phrase.id === refiningPhrase.id
                  ? { ...p, phrase: { ...p.phrase, audioPath } }
                  : p,
              ),
            );
            setRefiningPhrase((prev) => (prev ? { ...prev, audioPath } : null));
          }}
        />
      )}
    </div>
  );
}
