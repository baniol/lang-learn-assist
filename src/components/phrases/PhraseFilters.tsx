import { LANGUAGE_OPTIONS } from "../../types";

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
}

export function PhraseFilters({
  languageFilter,
  onLanguageFilterChange,
  searchQuery,
  onSearchQueryChange,
  currentLanguage,
}: PhraseFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Language filter */}
      <div className="flex items-center gap-1">
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
