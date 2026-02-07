import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, Button, Spinner } from "../ui";
import { getDecks } from "../../lib/decks";
import { useSettings } from "../../contexts/SettingsContext";
import type { DeckWithStats } from "../../types";

interface DeckSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (deckId: number | null) => void;
  currentDeckId: number | null;
  title?: string;
}

export function DeckSelector({
  isOpen,
  onClose,
  onSelect,
  currentDeckId,
  title = "Select Deck",
}: DeckSelectorProps) {
  const { settings } = useSettings();
  const [decks, setDecks] = useState<DeckWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to prevent state updates after unmount and handle race conditions
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadDecks = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getDecks(settings?.targetLanguage);

      // Only update state if still mounted and this is the latest request
      if (mountedRef.current && currentRequestId === requestIdRef.current) {
        setDecks(result);
      }
    } catch (err) {
      if (mountedRef.current && currentRequestId === requestIdRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load decks");
      }
    } finally {
      if (mountedRef.current && currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [settings?.targetLanguage]);

  useEffect(() => {
    if (isOpen) {
      loadDecks();
    }
  }, [isOpen, loadDecks]);

  const handleSelect = (deckId: number | null) => {
    onSelect(deckId);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} size="sm">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : error ? (
        <div className="text-red-500 text-center py-4">{error}</div>
      ) : (
        <div className="space-y-2">
          {/* Option to remove from deck */}
          {currentDeckId !== null && (
            <button
              onClick={() => handleSelect(null)}
              className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-red-600 dark:text-red-400"
            >
              Remove from deck
            </button>
          )}

          {/* Deck options */}
          {decks.length === 0 ? (
            <div className="text-center py-4 text-slate-500 dark:text-slate-400">
              No decks available. Create a deck first.
            </div>
          ) : (
            decks.map((deckWithStats) => {
              const { deck } = deckWithStats;
              const isSelected = deck.id === currentDeckId;

              return (
                <button
                  key={deck.id}
                  onClick={() => handleSelect(deck.id)}
                  disabled={isSelected}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <div className="font-medium text-slate-800 dark:text-white">
                    {deck.name}
                  </div>
                  {deck.description && (
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {deck.description}
                    </div>
                  )}
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {deckWithStats.totalPhrases} phrases • {deckWithStats.learningCount} learning
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
