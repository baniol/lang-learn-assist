import { invoke } from "@tauri-apps/api/core";
import { Spinner, Badge } from "../components/ui";
import { EmptyState } from "../components/shared";
import { ChartIcon } from "../components/icons";
import { useSettings } from "../contexts/SettingsContext";
import { useToast } from "../contexts/ToastContext";
import { useQuery } from "../hooks";
import type { LearningStats, SrsStats, PracticeSession } from "../types";
import { LANGUAGE_OPTIONS } from "../types";

export function StatsView() {
  const { settings } = useSettings();
  const toast = useToast();

  const { data, isLoading } = useQuery(
    async () => {
      const targetLang = settings?.targetLanguage || null;
      const [learningStats, srsStats, sessions] = await Promise.all([
        invoke<LearningStats>("get_learning_stats", {
          targetLanguage: targetLang,
        }),
        invoke<SrsStats>("get_srs_stats", { targetLanguage: targetLang }),
        invoke<PracticeSession[]>("get_practice_sessions", { limit: 20 }),
      ]);
      return { learningStats, srsStats, sessions };
    },
    [settings?.targetLanguage],
    {
      onError: (err) => toast.error(`Failed to load stats: ${err.message}`),
    }
  );

  const learningStats = data?.learningStats ?? null;
  const srsStats = data?.srsStats ?? null;
  const sessions = data?.sessions ?? [];

  const currentLangName =
    LANGUAGE_OPTIONS.find((l) => l.code === settings?.targetLanguage)?.name ||
    "All Languages";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
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
        1,
      )
    : 1;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          Statistics
        </h1>
        <Badge variant="default">{currentLangName}</Badge>
      </div>

      {/* Overview Cards */}
      {learningStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {learningStats.totalPhrases}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Total Phrases
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {learningStats.learnedCount}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              Learned
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {learningStats.learningCount}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Learning
            </p>
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
                <span className="text-slate-600 dark:text-slate-300">
                  Due now (overdue)
                </span>
                <span
                  className={`font-semibold ${srsStats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"}`}
                >
                  {srsStats.overdue}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">
                  Due today
                </span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {srsStats.dueToday}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">
                  Due tomorrow
                </span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {srsStats.dueTomorrow}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">
                  Due this week
                </span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {srsStats.dueThisWeek}
                </span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-300">
                    Total scheduled
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-white">
                    {srsStats.totalReviews}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-slate-600 dark:text-slate-300">
                    Avg. ease factor
                  </span>
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
                {
                  label: "1 day",
                  value: srsStats.intervalDistribution.oneDay,
                  color: "bg-red-500",
                },
                {
                  label: "2-3 days",
                  value: srsStats.intervalDistribution.twoToThreeDays,
                  color: "bg-orange-500",
                },
                {
                  label: "4-7 days",
                  value: srsStats.intervalDistribution.fourToSevenDays,
                  color: "bg-amber-500",
                },
                {
                  label: "1-2 weeks",
                  value: srsStats.intervalDistribution.oneToTwoWeeks,
                  color: "bg-lime-500",
                },
                {
                  label: "2+ weeks",
                  value: srsStats.intervalDistribution.twoWeeksPlus,
                  color: "bg-green-500",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-300">
                      {item.label}
                    </span>
                    <span className="text-slate-800 dark:text-white font-medium">
                      {item.value}
                    </span>
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
              Longer intervals = better retention. Phrases move to longer
              intervals as you answer correctly.
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
          <EmptyState
            icon={
              <ChartIcon
                size="xl"
                className="text-slate-300 dark:text-slate-600"
              />
            }
            title="No practice sessions yet"
            description="Start learning to see your progress!"
            className="py-4"
          />
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
                  const accuracy =
                    session.totalPhrases > 0
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
                      <td
                        className={`py-2 px-2 text-sm text-center font-medium ${getAccuracyColor(accuracy)}`}
                      >
                        {session.totalPhrases > 0
                          ? `${Math.round(accuracy * 100)}%`
                          : "-"}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge
                          variant={session.finishedAt ? "success" : "warning"}
                          size="sm"
                        >
                          {session.finishedAt ? "Completed" : "In Progress"}
                        </Badge>
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
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Total Sessions
            </p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {learningStats.totalSessions}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Average Success Rate
            </p>
            <p
              className={`text-2xl font-bold ${getAccuracyColor(learningStats.averageSuccessRate)}`}
            >
              {Math.round(learningStats.averageSuccessRate * 100)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
