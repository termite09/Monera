"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Transaction } from "@/types";
import { getPeriodBounds, formatCurrency } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface WeekdayChartProps {
  transactions: Transaction[];
  monthKey: string;
  paydayOfMonth?: number;
}

export function WeekdayChart({ transactions, monthKey, paydayOfMonth = 1 }: WeekdayChartProps) {
  const { start, end } = getPeriodBounds(monthKey, paydayOfMonth);
  const totals = [0, 0, 0, 0, 0, 0, 0];

  for (const t of transactions) {
    if (t.type !== "expense" || t.excluded) continue;
    const d = new Date(t.date + "T00:00:00");
    if (d < start || d > end) continue;
    // getDay(): 0=Sun…6=Sat — remap to Mon=0…Sun=6
    const idx = (d.getDay() + 6) % 7;
    totals[idx] += t.amount;
  }

  if (totals.every((v) => v === 0)) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        No spending data
      </div>
    );
  }

  const max = Math.max(...totals);
  const data = DAYS.map((day, i) => ({ day, amount: Math.round(totals[i] * 100) / 100 }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} width={40} />
        <Tooltip
          formatter={(v) => [formatCurrency(v as number), "Spent"]}
          contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
        />
        <Bar dataKey="amount" radius={[3, 3, 0, 0]} animationDuration={600}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.amount > 0 && entry.amount === max ? "#1C3557" : "#e2e8f0"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
