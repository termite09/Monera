"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Transaction } from "@/types";
import { getPeriodBounds, formatCurrency } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type WeekdayChartMode = "period" | "week";

interface WeekdayChartProps {
  transactions: Transaction[];
  monthKey: string;
  paydayOfMonth?: number;
  mode?: WeekdayChartMode;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Refunds are income tagged to an expense bucket (Needs/Wants/Savings). Salary
// lands as Uncategorized income and must never count as a negative spend.
const isRefund = (t: Transaction) =>
  t.type === "income" && !t.excluded && t.category !== "Uncategorized";

// Each bar nets refunds against spending so the chart can't show more outflow
// than the dashboard's net Expenses figure. Netting is per-bucket (refunds are
// small/rare, so the period sum reconciles with the dashboard to within the
// per-bucket flooring at zero). This stays a per-day distribution view.
function buildPeriodData(transactions: Transaction[], monthKey: string, paydayOfMonth: number) {
  const { start, end } = getPeriodBounds(monthKey, paydayOfMonth);
  const totals = [0, 0, 0, 0, 0, 0, 0];

  for (const t of transactions) {
    if (t.excluded) continue;
    const d = new Date(t.date + "T00:00:00");
    if (d < start || d > end) continue;
    const i = (d.getDay() + 6) % 7;
    if (t.type === "expense") totals[i] += t.amount;
    else if (isRefund(t)) totals[i] -= t.amount;
  }

  const netted = totals.map((v) => Math.max(0, Math.round(v * 100) / 100));
  const max = Math.max(...netted);
  return DAYS.map((day, i) => ({
    day,
    amount: netted[i],
    future: false,
    isMax: netted[i] > 0 && netted[i] === max,
  }));
}

function buildWeekData(transactions: Transaction[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek);

  const points = DAYS.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const future = d > today;
    const dayStr = toDateStr(d);
    const sameDay = transactions.filter((t) => !t.excluded && t.date === dayStr);
    const net = future
      ? 0
      : Math.max(
          0,
          Math.round(
            (sameDay.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0) -
              sameDay.filter(isRefund).reduce((s, t) => s + t.amount, 0)) * 100
          ) / 100
        );
    return { day, amount: net, future, isMax: false };
  });

  const max = Math.max(...points.map((p) => p.amount));
  return points.map((p) => ({ ...p, isMax: !p.future && p.amount > 0 && p.amount === max }));
}

export function WeekdayChart({ transactions, monthKey, paydayOfMonth = 1, mode = "period" }: WeekdayChartProps) {
  const data = mode === "week" ? buildWeekData(transactions) : buildPeriodData(transactions, monthKey, paydayOfMonth);

  const isEmpty = data.every((d) => d.amount === 0);
  if (isEmpty) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        {mode === "week" ? "No spending this week" : "No spending data"}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} width={48} />
        <Tooltip
          formatter={(v) => [formatCurrency(v as number), "Spent"]}
          contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
        />
        <Bar dataKey="amount" radius={[3, 3, 0, 0]} animationDuration={600}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.future ? "#f1f5f9" : entry.isMax ? "#1C3557" : "#e2e8f0"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
