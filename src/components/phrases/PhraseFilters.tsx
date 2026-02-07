import { cn } from "../../lib/utils";
import { StarIcon } from "../icons";
import { LANGUAGE_OPTIONS } from "../../types";
import type { DeckWithStats } from "../../types";

export type FilterStatus = "all" | "new" | "learning" | "learned";
export type ExcludedFilter = "active" | "excluded" | "all";
export type LanguageFilter = "all" | "current" | string;
export type DeckFilter = "all" | "no-deck" | number;

interface PhraseFiltersProps {
  filterStatus: FilterStatus;
  onFilterStatusChange: (status: FilterStatus) => void;
  showStarredOnly: boolean;
  onShowStarredOnlyChange: (value: boolean) => void;
  excludedFilter: ExcludedFilter;
  onExcludedFilterChange: (filter: ExcludedFilter) => void;
  languageFilter: LanguageFilter;
  onLanguageFilterChange: (filter: LanguageFilter) => void;
  deckFilter: DeckFilter;
  onDeckFilterChange: (filter: DeckFilter) => void;
  decks: DeckWithStats[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  currentLanguage?: string;
}

const STATUS_OPTIONS: FilterStatus[] = ["all", "new", "learning", "learned"];
const EXCLUDED_OPTIONS: ExcludedFilter[] = ["active", "excluded", "all"];

export function PhraseFilters({
  filterStatus,
  onFilterStatusChange,
  showStarredOnly,
  onShowStarredOnlyChange,
  excludedFilter,
  onExcludedFilterChange,
  languageFilter,
  onLanguageFilterChange,
  deckFilter,
  onDeckFilterChange,
  decks,
  searchQuery,
  onSearchQueryChange,
  currentLanguage,
}: PhraseFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Status filter */}
      <div className="flex items-center gap-2">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => onFilterStatusChange(status)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              filterStatus === status
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            )}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Starred filter */}
      <button
        onClick={() => onShowStarredOnlyChange(!showStarredOnly)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          showStarredOnly
            ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
        )}
      >
        <StarIcon size="xs" filled={showStarredOnly} />
        Starred
      </button>

      {/* Excluded filter */}
      <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-4">
        {EXCLUDED_OPTIONS.map((filter) => (
          <button
            key={filter}
            onClick={() => onExcludedFilterChange(filter)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              excludedFilter === filter
                ? filter === "excluded"
                  ? "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200"
                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            )}
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
          onChange={(e) => onLanguageFilterChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
        >
          <option value="current">
            {LANGUAGE_OPTIONS.find((l) => l.code === currentLanguage)?.name ||
              "Current"}{" "}
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

      {/* Deck filter */}
      <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-4">
        <select
          value={deckFilter === "all" ? "all" : deckFilter === "no-deck" ? "no-deck" : String(deckFilter)}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "all") {
              onDeckFilterChange("all");
            } else if (value === "no-deck") {
              onDeckFilterChange("no-deck");
            } else {
              onDeckFilterChange(Number(value));
            }
          }}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
        >
          <option value="all">All decks</option>
          <option value="no-deck">No deck</option>
          {decks.map((deckWithStats) => (
            <option key={deckWithStats.deck.id} value={deckWithStats.deck.id}>
              {deckWithStats.deck.name}
            </option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search phrases..."
          className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400"
        />
      </div>
    </div>
  );
}
