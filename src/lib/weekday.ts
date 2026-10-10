import { Transaction } from "@/types";
import { WEEKDAY_LABELS } from "@/config/constants";
import { formatShortDate, formatMonthYear, getPeriodRange, inRange, parseDateStr, roundMoney, toDateStr, daysInMonth, type DateRange } from "@/lib/utils";

export type WeekdayChartMode = "period" | "week" | "month" | "year";

export interface WeekdayPoint {
  day: string;
  /** Net spend: spending minus refunds, never below zero. What the bar shows. */
  amount: number;
  spent: number;
  refunded: number;
  /** A day later this week — drawn empty and not clickable. */
  future: boolean;
  isMax: boolean;
  /** The exact date, in week mode only. */
  dateStr: string | null;
}

// Refunds are income tagged to an expense bucket (Needs/Wants/Savings). Salary
// lands as Uncategorized income and must never count as a negative spend.
const isRefund = (t: Transaction) => t.type === "income" && t.category !== "Uncategorized";

/** Monday = 0 … Sunday = 6. */
const weekdayIndex = (dateStr: string) => (parseDateStr(dateStr).getDay() + 6) % 7;

function mondayOf(today: Date): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekdayIndex(toDateStr(today)));
}

/** The dates a chart mode covers: this week, a calendar month, a calendar year, or a pay period. */
export function chartRange(mode: WeekdayChartMode, key: string, paydayOfMonth: number, today: Date): DateRange {
  if (mode === "week") {
    const monday = mondayOf(today);
    return { from: toDateStr(monday), to: toDateStr(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)) };
  }
  const [y, m] = key.split("-").map(Number);
  if (mode === "month") return { from: `${key}-01`, to: `${key}-${String(daysInMonth(y, m - 1)).padStart(2, "0")}` };
  if (mode === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
  return getPeriodRange(key, paydayOfMonth);
}

export function chartRangeLabel(mode: WeekdayChartMode, key: string, paydayOfMonth: number, today: Date): string {
  if (mode === "month") return formatMonthYear(key, "long");
  if (mode === "year") return key.slice(0, 4);
  const { from, to } = chartRange(mode, key, paydayOfMonth, today);
  return `${formatShortDate(from)} – ${formatShortDate(to)}`;
}

/** Spending per weekday over the mode's range. In week mode each bar is one exact date. */
export function buildWeekdayData(
  transactions: Transaction[],
  mode: WeekdayChartMode,
  key: string,
  paydayOfMonth: number,
  today: Date
): WeekdayPoint[] {
  const range = chartRange(mode, key, paydayOfMonth, today);
  const spent = [0, 0, 0, 0, 0, 0, 0];
  const refunded = [0, 0, 0, 0, 0, 0, 0];
  for (const t of transactions) {
    if (t.excluded || !inRange(t.date, range)) continue;
    const i = weekdayIndex(t.date);
    if (t.type === "expense") spent[i] += t.amount;
    else if (isRefund(t)) refunded[i] += t.amount;
  }

  const todayStr = toDateStr(today);
  const monday = mondayOf(today);
  const points = WEEKDAY_LABELS.map((day, i) => {
    const dateStr = mode === "week" ? toDateStr(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)) : null;
    const future = dateStr !== null && dateStr > todayStr;
    return {
      day,
      amount: future ? 0 : roundMoney(Math.max(0, spent[i] - refunded[i])),
      spent: future ? 0 : roundMoney(spent[i]),
      refunded: future ? 0 : roundMoney(refunded[i]),
      future,
      isMax: false,
      dateStr,
    };
  });
  const max = Math.max(...points.map((p) => p.amount));
  return points.map((p) => ({ ...p, isMax: p.amount > 0 && p.amount === max }));
}

const FULL_DAY: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

/** "Saturday" for a short weekday label — used by the chart's spoken labels and takeaways. */
export function fullDayName(label: string): string {
  return FULL_DAY[label] ?? label;
}

/** Transactions behind one bar: the exact date in week mode, otherwise that weekday across the range. */
export function weekdayTransactions(
  transactions: Transaction[],
  mode: WeekdayChartMode,
  key: string,
  paydayOfMonth: number,
  today: Date,
  point: Pick<WeekdayPoint, "day" | "dateStr">
): Transaction[] {
  const dayIdx = WEEKDAY_LABELS.indexOf(point.day);
  const range = point.dateStr ? { from: point.dateStr, to: point.dateStr } : chartRange(mode, key, paydayOfMonth, today);
  return transactions
    .filter((t) => !t.excluded && inRange(t.date, range) && (point.dateStr !== null || weekdayIndex(t.date) === dayIdx))
    .sort((a, b) => b.date.localeCompare(a.date));
}
