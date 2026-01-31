import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTTS } from "../hooks/useTTS";
import { PhraseRefinementDialog } from "../components/PhraseRefinementDialog";
import type { PhraseWithProgress, CreatePhraseRequest, LearningStats, Phrase, UpdatePhraseRequest } from "../types";

type FilterStatus = "all" | "new" | "learning" | "learned";
type ExcludedFilter = "active" | "excluded" | "all";

export function PhraseLibraryView() {
  const [phrases, setPhrases] = useState<PhraseWithProgress[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [excludedFilter, setExcludedFilter] = useState<ExcludedFilter>("active");
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

  const handleAudioGenerated = useCallback(async (phraseId: number, audioPath: string) => {
    // Save audio path to database
    try {
      await invoke("update_phrase_audio", { id: phraseId, audioPath });
      // Update local state so next play uses cached path
      setPhrases((prev) =>
        prev.map((p) =>
          p.phrase.id === phraseId
            ? { ...p, phrase: { ...p.phrase, audioPath } }
            : p
        )
      );
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

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  // Load phrases when filters change
  useEffect(() => {
    loadPhrases();
  }, [showStarredOnly, excludedFilter, filterStatus, debouncedSearch]);

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
      const data = await invoke<PhraseWithProgress[]>("get_phrases", {
        starredOnly: showStarredOnly || null,
        excludedOnly: excludedFilter === "all" ? null : excludedFilter === "excluded",
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
          p.phrase.id === id ? { ...p, phrase: { ...p.phrase, starred: newStarred } } : p
        )
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
          p.phrase.id === id ? { ...p, phrase: { ...p.phrase, excluded: newExcluded } } : p
        )
      );
    } catch (err) {
      console.error("Failed to toggle excluded:", err);
    }
  };

  const handlePlay = useCallback(
    async (phrase: PhraseWithProgress) => {
      console.log("[TTS] handlePlay called for phrase:", phrase.phrase.id, phrase.phrase.answer);

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
          phrase.phrase.audioPath || undefined
        );
        console.log("[TTS] speak completed");
      } catch (err) {
        console.error("[TTS] Error in handlePlay:", err);
      }
      setPlayingId(null);
    },
    [tts, playingId]
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

  const handleRefineAccept = async (prompt: string, answer: string, accepted: string[]) => {
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
          : p
      )
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
            {stats ? `${stats.totalPhrases} phrases (${stats.learnedCount} learned, ${stats.learningCount} learning, ${stats.newCount} new)` : "Loading..."}
          </p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Phrase
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          {(["all", "new", "learning", "learned"] as FilterStatus[]).map((status) => (
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
          ))}
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
          <svg className="w-4 h-4" fill={showStarredOnly ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
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
              {filter === "active" ? "Active" : filter === "excluded" ? "Excluded" : "All"}
            </button>
          ))}
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : filteredPhrases.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
            No phrases found
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            {searchQuery ? "Try a different search" : "Add phrases from conversations or manually"}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
          {filteredPhrases.map((item) => {
            const p = item.phrase;
            const progress = item.progress;
            const isLearned = progress && progress.correctStreak >= 2;
            const isLearning = progress && progress.totalAttempts > 0 && !isLearned;

            return (
              <div
                key={p.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
              >
                {/* Star */}
                <button
                  onClick={() => handleToggleStar(p.id)}
                  className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex-shrink-0 ${
                    p.starred ? "text-yellow-500" : "text-slate-300 dark:text-slate-600"
                  }`}
                >
                  <svg className="w-5 h-5" fill={p.starred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{p.prompt}</p>
                  <p className="text-base font-medium text-slate-800 dark:text-white">{p.answer}</p>
                </div>

                {/* Status badge */}
                <span className={`text-xs font-medium px-2 py-1 rounded flex-shrink-0 ${
                  isLearned
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : isLearning
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}>
                  {isLearned ? "Learned" : isLearning ? "Learning" : "New"}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handlePlay(item)}
                    disabled={tts.isLoading && playingId === p.id}
                    className="p-2 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors"
                    title="Play"
                  >
                    {tts.isLoading && playingId === p.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                    ) : playingId === p.id ? (
                      <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setRefiningPhrase(p)}
                    className="p-2 rounded text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors opacity-0 group-hover:opacity-100"
                    title="Refine with AI"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleToggleExcluded(p.id)}
                    className={`p-2 rounded transition-colors opacity-0 group-hover:opacity-100 ${
                      p.excluded
                        ? "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
                        : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                    title={p.excluded ? "Include in learning" : "Exclude from learning"}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {p.excluded ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(p.id);
                    }}
                    className="p-2 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Phrase Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                Add New Phrase
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Prompt (Polish)
                </label>
                <input
                  type="text"
                  value={newPhrase.prompt}
                  onChange={(e) => setNewPhrase({ ...newPhrase, prompt: e.target.value })}
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
                  onChange={(e) => setNewPhrase({ ...newPhrase, answer: e.target.value })}
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
                  onChange={(e) => setNewPhrase({ ...newPhrase, notes: e.target.value })}
                  placeholder="Any helpful notes..."
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewPhrase({ prompt: "", answer: "", accepted: [], notes: "" });
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPhrase}
                disabled={!newPhrase.prompt.trim() || !newPhrase.answer.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Phrase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Delete phrase?
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              This will permanently delete this phrase and its progress.
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
                  : p
              )
            );
            setRefiningPhrase((prev) =>
              prev ? { ...prev, audioPath } : null
            );
          }}
        />
      )}
    </div>
  );
}
