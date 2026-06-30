"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Transaction } from "@/types";
import { getPeriodBounds, formatCurrency, formatShortDate, toDateStr } from "@/lib/utils";
import { WEEKDAY_LABELS } from "@/config/constants";

export type WeekdayChartMode = "period" | "week" | "month" | "year";

interface WeekdayChartProps {
  transactions: Transaction[];
  monthKey: string;
  paydayOfMonth?: number;
  mode?: WeekdayChartMode;
  onDayClick?: (label: string, dateStr: string | null) => void;
}

// Refunds are income tagged to an expense bucket (Needs/Wants/Savings). Salary
// lands as Uncategorized income and must never count as a negative spend.
const isRefund = (t: Transaction) =>
  t.type === "income" && !t.excluded && t.category !== "Uncategorized";

function buildPeriodData(transactions: Transaction[], monthKey: string, paydayOfMonth: number) {
  const { start, end } = getPeriodBounds(monthKey, paydayOfMonth);
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const spent = [0, 0, 0, 0, 0, 0, 0];
  const received = [0, 0, 0, 0, 0, 0, 0];

  for (const t of transactions) {
    if (t.excluded) continue;
    const d = new Date(t.date + "T00:00:00");
    if (d < start || d > end) continue;
    const i = (d.getDay() + 6) % 7;
    if (t.type === "expense") { totals[i] += t.amount; spent[i] += t.amount; }
    else if (t.type === "income") {
      received[i] += t.amount;
      if (isRefund(t)) totals[i] -= t.amount;
    }
  }

  const netted = totals.map((v) => Math.max(0, Math.round(v * 100) / 100));
  const max = Math.max(...netted);
  return WEEKDAY_LABELS.map((day, i) => ({
    day,
    amount: netted[i],
    spent: Math.round(spent[i] * 100) / 100,
    received: Math.round(received[i] * 100) / 100,
    future: false,
    isMax: netted[i] > 0 && netted[i] === max,
    dateStr: null as string | null,
  }));
}

function buildWeekData(transactions: Transaction[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek);

  const points = WEEKDAY_LABELS.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const future = d > today;
    const dayStr = toDateStr(d);
    const sameDay = transactions.filter((t) => !t.excluded && t.date === dayStr);
    const daySpent = sameDay.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const dayReceived = sameDay.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const dayRefunds = sameDay.filter(isRefund).reduce((s, t) => s + t.amount, 0);
    const net = future ? 0 : Math.max(0, Math.round((daySpent - dayRefunds) * 100) / 100);
    return {
      day,
      amount: net,
      spent: future ? 0 : Math.round(daySpent * 100) / 100,
      received: future ? 0 : Math.round(dayReceived * 100) / 100,
      future,
      isMax: false,
      dateStr: dayStr,
    };
  });

  const max = Math.max(...points.map((p) => p.amount));
  return points.map((p) => ({ ...p, isMax: !p.future && p.amount > 0 && p.amount === max }));
}

function buildMonthData(transactions: Transaction[], monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(y, m, 0);
  end.setHours(23, 59, 59, 999);
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const spent = [0, 0, 0, 0, 0, 0, 0];
  const received = [0, 0, 0, 0, 0, 0, 0];
  for (const t of transactions) {
    if (t.excluded) continue;
    const d = new Date(t.date + "T00:00:00");
    if (d < start || d > end) continue;
    const i = (d.getDay() + 6) % 7;
    if (t.type === "expense") { totals[i] += t.amount; spent[i] += t.amount; }
    else if (t.type === "income") {
      received[i] += t.amount;
      if (isRefund(t)) totals[i] -= t.amount;
    }
  }
  const netted = totals.map((v) => Math.max(0, Math.round(v * 100) / 100));
  const max = Math.max(...netted);
  return WEEKDAY_LABELS.map((day, i) => ({
    day,
    amount: netted[i],
    spent: Math.round(spent[i] * 100) / 100,
    received: Math.round(received[i] * 100) / 100,
    future: false,
    isMax: netted[i] > 0 && netted[i] === max,
    dateStr: null as string | null,
  }));
}

// Year mode: same as month mode but spanning the full calendar year.
// Each bar shows the total spent on that weekday across every week of the year.
function buildYearData(transactions: Transaction[], monthKey: string) {
  const [y] = monthKey.split("-").map(Number);
  const start = new Date(y, 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(y, 11, 31);
  end.setHours(23, 59, 59, 999);
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const spent = [0, 0, 0, 0, 0, 0, 0];
  const received = [0, 0, 0, 0, 0, 0, 0];
  for (const t of transactions) {
    if (t.excluded) continue;
    const d = new Date(t.date + "T00:00:00");
    if (d < start || d > end) continue;
    const i = (d.getDay() + 6) % 7;
    if (t.type === "expense") { totals[i] += t.amount; spent[i] += t.amount; }
    else if (t.type === "income") {
      received[i] += t.amount;
      if (isRefund(t)) totals[i] -= t.amount;
    }
  }
  const netted = totals.map((v) => Math.max(0, Math.round(v * 100) / 100));
  const max = Math.max(...netted);
  return WEEKDAY_LABELS.map((day, i) => ({
    day,
    amount: netted[i],
    spent: Math.round(spent[i] * 100) / 100,
    received: Math.round(received[i] * 100) / 100,
    future: false,
    isMax: netted[i] > 0 && netted[i] === max,
    dateStr: null as string | null,
  }));
}

export function getChartDateRange(
  mode: WeekdayChartMode,
  monthKey: string,
  paydayOfMonth = 1
): string {
  if (mode === "week") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${formatShortDate(toDateStr(monday))} – ${formatShortDate(toDateStr(sunday))}`;
  }
  if (mode === "month") {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  if (mode === "period") {
    const { start, end } = getPeriodBounds(monthKey, paydayOfMonth);
    return `${formatShortDate(toDateStr(start))} – ${formatShortDate(toDateStr(end))}`;
  }
  // year
  const [y] = monthKey.split("-").map(Number);
  return String(y);
}

interface BarTooltipPayload {
  day: string;
  spent: number;
  received: number;
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: { payload: BarTooltipPayload }[] }) {
  if (!active || !payload?.length) return null;
  const { spent, received } = payload[0].payload;
  const net = spent - received;
  return (
    <div
      style={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
      className="bg-card px-3 py-2 shadow-sm flex flex-col gap-1 min-w-32 font-mono"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Spent</span>
        <span className="text-foreground">{formatCurrency(spent)}</span>
      </div>
      {received > 0 && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Received</span>
          <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(received)}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 border-t border-border pt-1 font-semibold">
        <span>Net</span>
        <span className={net <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}>
          {net > 0 ? "− " : net < 0 ? "+ " : ""}{formatCurrency(Math.abs(net))}
        </span>
      </div>
    </div>
  );
}

export function WeekdayChart({
  transactions,
  monthKey,
  paydayOfMonth = 1,
  mode = "period",
  onDayClick,
}: WeekdayChartProps) {
  const data =
    mode === "week" ? buildWeekData(transactions) :
    mode === "month" ? buildMonthData(transactions, monthKey) :
    mode === "year" ? buildYearData(transactions, monthKey) :
    buildPeriodData(transactions, monthKey, paydayOfMonth);

  const isEmpty = data.every((d) => d.amount === 0);

  // Mobile renders at a fixed 120px; on desktop the chart fills its (fixed-height)
  // card via flex, so the bars grow to use the available vertical space.
  if (isEmpty) {
    const emptyMsg =
      mode === "week" ? "No spending this week" :
      mode === "month" ? "No spending this calendar month" :
      mode === "year" ? "No spending this year" :
      "No spending this period";
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground h-40 md:h-full">
        {emptyMsg}
      </div>
    );
  }

  const hasFuture = data.some((d) => d.future);

  return (
    <div className="md:h-full md:flex md:flex-col">
      <div className="h-40 md:h-auto md:flex-1 md:min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} width={48} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar
              dataKey="amount"
              radius={[3, 3, 0, 0]}
              animationDuration={600}
              style={onDayClick ? { cursor: "pointer" } : undefined}
              onClick={onDayClick ? (barData) => {
                const p = barData.payload as { day: string; dateStr: string | null };
                onDayClick(p.day, p.dateStr);
              } : undefined}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.day}
                  fill={entry.future ? "#f1f5f9" : entry.isMax ? "#1C3557" : "#e2e8f0"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-3 mt-1 px-1 justify-end md:shrink-0">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block size-2 rounded-sm bg-[#1C3557]" />
          Highest
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block size-2 rounded-sm bg-[#e2e8f0]" />
          Spending
        </span>
        {hasFuture && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block size-2 rounded-sm bg-[#f1f5f9]" />
            Upcoming
          </span>
        )}
      </div>
    </div>
  );
}
