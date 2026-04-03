import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getExerciseCalendar,
  getExerciseDayDetails,
  getAllExerciseSessions,
  getSessionPhrases,
  deleteExerciseSession,
} from "../api";
import { Spinner } from "../components/ui";
import {
  CloseIcon,
  CalendarIcon,
  ChartIcon,
  CheckCircleIcon,
  TrashIcon,
} from "../components/icons";
import { cn } from "../lib/utils";
import { LANGUAGE_OPTIONS } from "../types";
import type { ExerciseSession, SessionPhraseRecord } from "../types";

// ============================================================================
// Helpers
// ============================================================================

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dayOfWeek(year: number, month: number, day: number): number {
  const d = new Date(year, month, day).getDay();
  return d === 0 ? 6 : d - 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function languageName(code: string): string {
  return LANGUAGE_OPTIONS.find((l) => l.code === code)?.name ?? code;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString + "Z");
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isoToday(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ============================================================================
// Calendar Month
// ============================================================================

interface CalendarMonthProps {
  year: number;
  month: number;
  activeDates: Set<string>;
  sessionCountByDate: Map<string, number>;
  selectedDate: string | null;
  onDayClick: (date: string) => void;
}

function CalendarMonth({
  year,
  month,
  activeDates,
  sessionCountByDate,
  selectedDate,
  onDayClick,
}: CalendarMonthProps) {
  const days = daysInMonth(year, month);
  const firstDow = dayOfWeek(year, month, 1);
  const today = isoToday();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
        {MONTHS[month]} {year}
      </h3>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-slate-400 dark:text-slate-500 pb-1"
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const iso = isoDate(year, month, day);
          const isActive = activeDates.has(iso);
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          const sessionCount = sessionCountByDate.get(iso) ?? 0;
          return (
            <button
              key={i}
              onClick={() => isActive && onDayClick(iso)}
              disabled={!isActive}
              className={cn(
                "relative aspect-square flex items-center justify-center rounded text-xs font-medium transition-colors",
                isSelected
                  ? "bg-blue-600 text-white ring-2 ring-blue-400"
                  : isActive
                    ? "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
                    : isToday
                      ? "ring-1 ring-blue-400 text-slate-700 dark:text-slate-200"
                      : "text-slate-500 dark:text-slate-400"
              )}
            >
              {day}
              {isActive && sessionCount > 1 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {sessionCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Day Details
// ============================================================================

interface DayDetailsProps {
  date: string;
  sessions: ExerciseSession[];
  onClose: () => void;
  onDeleteSession: (sessionId: number) => void;
}

function SessionPhrasesList({
  sessionId,
  onFailedCount,
}: {
  sessionId: number;
  onFailedCount?: (count: number) => void;
}) {
  const [phrases, setPhrases] = useState<SessionPhraseRecord[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getSessionPhrases(sessionId)
      .then((p) => {
        setPhrases(p);
        onFailedCount?.(p.filter((x) => x.attempts > 1).length);
      })
      .catch(console.error);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const failedPhrases = phrases.filter((p) => p.attempts > 1);

  if (failedPhrases.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium"
      >
        {expanded ? "▾" : "▸"} {failedPhrases.length} failed{" "}
        {failedPhrases.length === 1 ? "phrase" : "phrases"}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {failedPhrases.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-2 py-1 bg-amber-50 dark:bg-amber-900/10 rounded text-xs border border-amber-100 dark:border-amber-800/50"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-slate-700 dark:text-slate-200 truncate block">
                  {p.prompt}
                </span>
                <span className="text-slate-500 dark:text-slate-400 truncate block">
                  {p.answer}
                </span>
              </div>
              <span className="text-amber-600 dark:text-amber-400 font-medium flex-shrink-0 ml-2">
                {p.attempts}x
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session: s,
  onDeleteSession,
}: {
  session: ExerciseSession;
  onDeleteSession: (id: number) => void;
}) {
  const [failedCount, setFailedCount] = useState(0);
  const isCompleted = s.phrasesCompleted === s.phrasesTotal && s.phrasesTotal > 0;
  const hasFailed = failedCount > 0;
  const rate =
    s.phrasesTotal > 0
      ? Math.round(((s.phrasesCompleted - failedCount) / s.phrasesTotal) * 100)
      : 0;
  const barColor = !isCompleted
    ? rate >= 50
      ? "bg-blue-500"
      : "bg-amber-500"
    : hasFailed
      ? "bg-amber-500"
      : "bg-green-500";
  const rateColor = !isCompleted
    ? rate >= 50
      ? "text-blue-600 dark:text-blue-400"
      : "text-amber-600 dark:text-amber-400"
    : hasFailed
      ? "text-amber-600 dark:text-amber-400"
      : "text-green-600 dark:text-green-400";

  return (
    <div className="p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {formatTime(s.createdAt)}
          </span>
          {isCompleted ? (
            <span
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                hasFailed
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-green-600 dark:text-green-400"
              )}
            >
              <CheckCircleIcon size="sm" />
              {hasFailed ? "Completed with errors" : "Completed"}
            </span>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Incomplete
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {languageName(s.targetLanguage)}
          </span>
          <button
            onClick={() => onDeleteSession(s.id)}
            className="p-1 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
            title="Delete session"
          >
            <TrashIcon size="sm" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
          <div
            className={cn("h-2 rounded-full transition-all", barColor)}
            style={{ width: `${rate}%` }}
          />
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
          {s.phrasesCompleted - failedCount}/{s.phrasesTotal}
        </span>
        <span className={cn("text-sm font-bold whitespace-nowrap", rateColor)}>{rate}%</span>
      </div>
      <SessionPhrasesList sessionId={s.id} onFailedCount={setFailedCount} />
    </div>
  );
}

function DayDetails({ date, sessions, onClose, onDeleteSession }: DayDetailsProps) {
  const totalCompleted = sessions.reduce((s, e) => s + e.phrasesCompleted, 0);
  const totalPhrases = sessions.reduce((s, e) => s + e.phrasesTotal, 0);

  const byLanguage = new Map<string, { sessions: number; completed: number; total: number }>();
  for (const s of sessions) {
    const lang = s.targetLanguage;
    const entry = byLanguage.get(lang) ?? { sessions: 0, completed: 0, total: 0 };
    entry.sessions += 1;
    entry.completed += s.phrasesCompleted;
    entry.total += s.phrasesTotal;
    byLanguage.set(lang, entry);
  }

  const formattedDate = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{formattedDate}</h3>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <CloseIcon size="sm" />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center">
          <p className="text-xl font-bold text-slate-800 dark:text-white">{sessions.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {sessions.length === 1 ? "session" : "sessions"}
          </p>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center">
          <p className="text-xl font-bold text-slate-800 dark:text-white">{totalCompleted}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">completed</p>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center">
          <p className="text-xl font-bold text-slate-800 dark:text-white">{totalPhrases}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">total phrases</p>
        </div>
      </div>

      {/* By language */}
      {byLanguage.size > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            By Language
          </h4>
          <div className="space-y-2">
            {[...byLanguage.entries()].map(([lang, stats]) => (
              <div
                key={lang}
                className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-700/50 rounded"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {languageName(lang)}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {stats.sessions} {stats.sessions === 1 ? "session" : "sessions"} &middot;{" "}
                  {stats.completed}/{stats.total} phrases
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual sessions */}
      <div>
        <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Sessions
        </h4>
        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onDeleteSession={onDeleteSession} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Summary Tab
// ============================================================================

interface PeriodStats {
  sessions: number;
  activeDays: number;
  phrasesCompleted: number;
  phrasesTotal: number;
  successRate: number;
  byLanguage: Map<string, { sessions: number; completed: number; total: number }>;
}

function computePeriodStats(sessions: ExerciseSession[], fromDate: string): PeriodStats {
  const filtered = sessions.filter((s) => s.date >= fromDate);
  const activeDays = new Set(filtered.map((s) => s.date)).size;
  const phrasesCompleted = filtered.reduce((sum, s) => sum + s.phrasesCompleted, 0);
  const phrasesTotal = filtered.reduce((sum, s) => sum + s.phrasesTotal, 0);
  const successRate = phrasesTotal > 0 ? Math.round((phrasesCompleted / phrasesTotal) * 100) : 0;

  const byLanguage = new Map<string, { sessions: number; completed: number; total: number }>();
  for (const s of filtered) {
    const entry = byLanguage.get(s.targetLanguage) ?? {
      sessions: 0,
      completed: 0,
      total: 0,
    };
    entry.sessions += 1;
    entry.completed += s.phrasesCompleted;
    entry.total += s.phrasesTotal;
    byLanguage.set(s.targetLanguage, entry);
  }

  return {
    sessions: filtered.length,
    activeDays,
    phrasesCompleted,
    phrasesTotal,
    successRate,
    byLanguage,
  };
}

function PeriodCard({ label, stats }: { label: string; stats: PeriodStats }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
        {label}
      </h3>

      {stats.sessions === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No exercise sessions</p>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.sessions}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">sessions</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {stats.activeDays}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">active days</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {stats.phrasesCompleted}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">phrases completed</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center">
              <p
                className={cn(
                  "text-2xl font-bold",
                  stats.successRate === 100
                    ? "text-green-600 dark:text-green-400"
                    : stats.successRate >= 50
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-amber-600 dark:text-amber-400"
                )}
              >
                {stats.successRate}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">success rate</p>
            </div>
          </div>

          {/* By language */}
          {stats.byLanguage.size > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                By Language
              </h4>
              <div className="space-y-2">
                {[...stats.byLanguage.entries()].map(([lang, langStats]) => {
                  const langRate =
                    langStats.total > 0
                      ? Math.round((langStats.completed / langStats.total) * 100)
                      : 0;
                  return (
                    <div
                      key={lang}
                      className="flex items-center justify-between py-1.5 px-3 bg-slate-50 dark:bg-slate-700/50 rounded"
                    >
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {languageName(lang)}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {langStats.sessions} sess &middot; {langStats.completed}/{langStats.total}{" "}
                        &middot; {langRate}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryTab({ sessions }: { sessions: ExerciseSession[] }) {
  const weekStats = useMemo(() => computePeriodStats(sessions, daysAgo(7)), [sessions]);
  const monthStats = useMemo(() => computePeriodStats(sessions, daysAgo(30)), [sessions]);
  const halfYearStats = useMemo(() => computePeriodStats(sessions, daysAgo(182)), [sessions]);

  return (
    <div className="space-y-6">
      <PeriodCard label="Last 7 days" stats={weekStats} />
      <PeriodCard label="Last 30 days" stats={monthStats} />
      <PeriodCard label="Last 6 months" stats={halfYearStats} />
    </div>
  );
}

// ============================================================================
// Main View
// ============================================================================

type StatsTab = "calendar" | "summary";

export function ExerciseStatsView() {
  const [tab, setTab] = useState<StatsTab>("calendar");
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [daySessions, setDaySessions] = useState<ExerciseSession[]>([]);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [allSessions, setAllSessions] = useState<ExerciseSession[]>([]);

  useEffect(() => {
    Promise.all([getExerciseCalendar(), getAllExerciseSessions()])
      .then(([dates, sessions]) => {
        setActiveDates(new Set(dates));
        setAllSessions(sessions);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleDayClick = useCallback(async (date: string) => {
    setSelectedDate(date);
    setIsLoadingDay(true);
    try {
      const sessions = await getExerciseDayDetails(date);
      setDaySessions(sessions);
    } catch (err) {
      console.error("Failed to load day details:", err);
      setDaySessions([]);
    } finally {
      setIsLoadingDay(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    setSelectedDate(null);
    setDaySessions([]);
  }, []);

  const handleDeleteSession = useCallback(
    async (sessionId: number) => {
      try {
        await deleteExerciseSession(sessionId);
        setDaySessions((prev) => prev.filter((s) => s.id !== sessionId));
        setAllSessions((prev) => prev.filter((s) => s.id !== sessionId));
        // If no sessions left for this day, update calendar and go back
        setDaySessions((current) => {
          if (current.length === 0 && selectedDate) {
            setActiveDates((dates) => {
              const next = new Set(dates);
              next.delete(selectedDate);
              return next;
            });
            setSelectedDate(null);
          }
          return current;
        });
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [selectedDate]
  );

  const sessionCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of allSessions) {
      map.set(s.date, (map.get(s.date) ?? 0) + 1);
    }
    return map;
  }, [allSessions]);

  const today = new Date();
  const months: { year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        {selectedDate ? (
          <button
            onClick={handleBack}
            className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 mb-1"
          >
            &larr; Back to calendar
          </button>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
              Exercise Stats
            </h1>
            {/* Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
              <button
                onClick={() => setTab("calendar")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  tab === "calendar"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <CalendarIcon size="sm" />
                Calendar
              </button>
              <button
                onClick={() => setTab("summary")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  tab === "summary"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <ChartIcon size="sm" />
                Summary
              </button>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : selectedDate ? (
          isLoadingDay ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" />
            </div>
          ) : (
            <DayDetails
              date={selectedDate}
              sessions={daySessions}
              onClose={handleBack}
              onDeleteSession={handleDeleteSession}
            />
          )
        ) : tab === "calendar" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {months.map(({ year, month }) => (
              <CalendarMonth
                key={`${year}-${month}`}
                year={year}
                month={month}
                activeDates={activeDates}
                sessionCountByDate={sessionCountByDate}
                selectedDate={selectedDate}
                onDayClick={handleDayClick}
              />
            ))}
          </div>
        ) : (
          <SummaryTab sessions={allSessions} />
        )}
      </div>
    </div>
  );
}
