import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { LearningStats, SrsStats, PracticeSession } from "../types";

export function StatsView() {
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [srsStats, setSrsStats] = useState<SrsStats | null>(null);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllStats();
  }, []);

  const loadAllStats = async () => {
    setIsLoading(true);
    try {
      const [learning, srs, sessionList] = await Promise.all([
        invoke<LearningStats>("get_learning_stats", {}),
        invoke<SrsStats>("get_srs_stats"),
        invoke<PracticeSession[]>("get_practice_sessions", { limit: 20 }),
      ]);
      setLearningStats(learning);
      setSrsStats(srs);
      setSessions(sessionList);
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "Z");
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.8) return "text-green-600 dark:text-green-400";
    if (accuracy >= 0.6) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const maxInterval = srsStats
    ? Math.max(
        srsStats.intervalDistribution.oneDay,
        srsStats.intervalDistribution.twoToThreeDays,
        srsStats.intervalDistribution.fourToSevenDays,
        srsStats.intervalDistribution.oneToTwoWeeks,
        srsStats.intervalDistribution.twoWeeksPlus,
        1
      )
    : 1;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Statistics</h1>

      {/* Overview Cards */}
      {learningStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {learningStats.totalPhrases}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Phrases</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {learningStats.learnedCount}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">Learned</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {learningStats.learningCount}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400">Learning</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 p-4 text-center">
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">
              {learningStats.newCount}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">New</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* SRS Review Schedule */}
        {srsStats && (
          <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
              Review Schedule
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">Due now (overdue)</span>
                <span className={`font-semibold ${srsStats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"}`}>
                  {srsStats.overdue}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">Due today</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {srsStats.dueToday}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">Due tomorrow</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {srsStats.dueTomorrow}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">Due this week</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {srsStats.dueThisWeek}
                </span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">Total scheduled</span>
                  <span className="font-semibold text-slate-800 dark:text-white">
                    {srsStats.totalReviews}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-slate-600 dark:text-slate-300">Avg. ease factor</span>
                  <span className="font-semibold text-slate-800 dark:text-white">
                    {srsStats.averageEaseFactor.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Interval Distribution */}
        {srsStats && (
          <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
              Review Intervals
            </h2>
            <div className="space-y-3">
              {[
                { label: "1 day", value: srsStats.intervalDistribution.oneDay, color: "bg-red-500" },
                { label: "2-3 days", value: srsStats.intervalDistribution.twoToThreeDays, color: "bg-orange-500" },
                { label: "4-7 days", value: srsStats.intervalDistribution.fourToSevenDays, color: "bg-amber-500" },
                { label: "1-2 weeks", value: srsStats.intervalDistribution.oneToTwoWeeks, color: "bg-lime-500" },
                { label: "2+ weeks", value: srsStats.intervalDistribution.twoWeeksPlus, color: "bg-green-500" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                    <span className="text-slate-800 dark:text-white font-medium">{item.value}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className={`${item.color} h-2 rounded-full transition-all`}
                      style={{ width: `${(item.value / maxInterval) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
              Longer intervals = better retention. Phrases move to longer intervals as you answer correctly.
            </p>
          </section>
        )}
      </div>

      {/* Session History */}
      <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
          Recent Sessions
        </h2>
        {sessions.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-4">
            No practice sessions yet. Start learning to see your progress!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Date
                  </th>
                  <th className="text-left py-2 px-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Mode
                  </th>
                  <th className="text-center py-2 px-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Phrases
                  </th>
                  <th className="text-center py-2 px-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Correct
                  </th>
                  <th className="text-center py-2 px-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Accuracy
                  </th>
                  <th className="text-center py-2 px-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const accuracy = session.totalPhrases > 0
                    ? session.correctAnswers / session.totalPhrases
                    : 0;
                  return (
                    <tr
                      key={session.id}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    >
                      <td className="py-2 px-2 text-sm text-slate-800 dark:text-white">
                        {formatDate(session.startedAt)}
                      </td>
                      <td className="py-2 px-2 text-sm text-slate-600 dark:text-slate-300 capitalize">
                        {session.exerciseMode}
                      </td>
                      <td className="py-2 px-2 text-sm text-slate-800 dark:text-white text-center">
                        {session.totalPhrases}
                      </td>
                      <td className="py-2 px-2 text-sm text-slate-800 dark:text-white text-center">
                        {session.correctAnswers}
                      </td>
                      <td className={`py-2 px-2 text-sm text-center font-medium ${getAccuracyColor(accuracy)}`}>
                        {session.totalPhrases > 0 ? `${Math.round(accuracy * 100)}%` : "-"}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {session.finishedAt ? (
                          <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                            Completed
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                            In Progress
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Overall Stats */}
      {learningStats && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Sessions</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {learningStats.totalSessions}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Average Success Rate</p>
            <p className={`text-2xl font-bold ${getAccuracyColor(learningStats.averageSuccessRate)}`}>
              {Math.round(learningStats.averageSuccessRate * 100)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
