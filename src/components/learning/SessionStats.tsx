import type { LearningStats } from "../../types";

interface SessionStatsProps {
  stats: LearningStats;
}

export function SessionStats({ stats }: SessionStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
        <p className="text-2xl font-bold text-slate-800 dark:text-white">
          {stats.totalPhrases}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
      </div>
      <div className="bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 p-4 text-center">
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {stats.learnedCount}
        </p>
        <p className="text-sm text-green-600 dark:text-green-400">Learned</p>
      </div>
      <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800 p-4 text-center">
        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
          {stats.learningCount}
        </p>
        <p className="text-sm text-amber-600 dark:text-amber-400">Learning</p>
      </div>
      <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-4 text-center">
        <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">
          {stats.newCount}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">New</p>
      </div>
    </div>
  );
}
