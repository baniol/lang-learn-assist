import type { LearningStats } from "../../types";

interface SessionStatsProps {
  stats: LearningStats;
}

export function SessionStats({ stats }: SessionStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
        <p className="text-2xl font-bold text-slate-800 dark:text-white">
          {stats.totalPhrases}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Total Phrases</p>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 p-4 text-center">
        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {stats.inDecksCount}
        </p>
        <p className="text-sm text-blue-600 dark:text-blue-400">In Decks</p>
      </div>
      <div className="bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 p-4 text-center">
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {stats.graduatedToSrsCount}
        </p>
        <p className="text-sm text-green-600 dark:text-green-400">In SRS</p>
      </div>
    </div>
  );
}
