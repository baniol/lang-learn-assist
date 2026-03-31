import { LANGUAGE_OPTIONS } from "../../types";
import { TagDropdown } from "./TagDropdown";
import { StarIcon } from "../icons";
import { cn } from "../../lib/utils";

export type FilterStatus = "all" | "new" | "learning" | "learned";
export type LanguageFilter = "all" | "current" | string;

interface PhraseFiltersProps {
  filterStatus: FilterStatus;
  onFilterStatusChange: (status: FilterStatus) => void;
  languageFilter: LanguageFilter;
  onLanguageFilterChange: (filter: LanguageFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  currentLanguage?: string;
  selectedTagId: number | null;
  onTagSelect: (tagId: number | null) => void;
  starredOnly: boolean;
  onStarredOnlyChange: (value: boolean) => void;
}

export function PhraseFilters({
  languageFilter,
  onLanguageFilterChange,
  searchQuery,
  onSearchQueryChange,
  currentLanguage,
  selectedTagId,
  onTagSelect,
  starredOnly,
  onStarredOnlyChange,
}: PhraseFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Tag filter */}
      <TagDropdown selectedTagId={selectedTagId} onTagSelect={onTagSelect} />

      {/* Starred filter */}
      <button
        onClick={() => onStarredOnlyChange(!starredOnly)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
          starredOnly
            ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400"
            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        )}
      >
        <StarIcon size="sm" filled={starredOnly} />
        Starred
      </button>

      {/* Language filter */}
      <div className="flex items-center gap-1">
        <select
          value={languageFilter}
          onChange={(e) => onLanguageFilterChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
        >
          <option value="current">
            {LANGUAGE_OPTIONS.find((l) => l.code === currentLanguage)?.name || "Current"} only
          </option>
          <option value="all">All languages</option>
          {LANGUAGE_OPTIONS.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
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
