import { useState, useEffect } from "react";
import { getExerciseCalendar } from "../api";
import { Spinner } from "../components/ui";
import { cn } from "../lib/utils";

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

// Returns day-of-week index 0=Mon … 6=Sun
function dayOfWeek(year: number, month: number, day: number): number {
  const d = new Date(year, month, day).getDay();
  return d === 0 ? 6 : d - 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

interface CalendarMonthProps {
  year: number;
  month: number;
  activeDates: Set<string>;
}

function CalendarMonth({ year, month, activeDates }: CalendarMonthProps) {
  const days = daysInMonth(year, month);
  const firstDow = dayOfWeek(year, month, 1);
  const today = new Date().toISOString().split("T")[0];

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  // Pad to complete last row
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
          return (
            <div
              key={i}
              className={cn(
                "aspect-square flex items-center justify-center rounded text-xs font-medium",
                isActive
                  ? "bg-blue-500 text-white"
                  : isToday
                    ? "ring-1 ring-blue-400 text-slate-700 dark:text-slate-200"
                    : "text-slate-500 dark:text-slate-400"
              )}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ExerciseStatsView() {
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getExerciseCalendar()
      .then((dates) => setActiveDates(new Set(dates)))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const today = new Date();
  // Show current month and 5 previous months (6 total)
  const months: { year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 pt-6 pb-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Exercise Stats</h1>
        <p className="text-slate-500 dark:text-slate-400">
          {activeDates.size} {activeDates.size === 1 ? "day" : "days"} with exercise
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {months.map(({ year, month }) => (
              <CalendarMonth
                key={`${year}-${month}`}
                year={year}
                month={month}
                activeDates={activeDates}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
