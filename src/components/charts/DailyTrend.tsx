"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface DailyTrendProps {
  transactions: Transaction[];
  month: string;
}

export function DailyTrend({ transactions, month }: DailyTrendProps) {
  const expenses = transactions.filter((t) => t.type === "expense" && t.month === month);

  const byDay: Record<string, number> = {};
  expenses.forEach((t) => {
    const day = t.date.split("-")[2];
    byDay[day] = (byDay[day] ?? 0) + t.amount;
  });

  const data = Object.entries(byDay)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([day, amount]) => ({ day: parseInt(day), amount }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        No data for this month
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} width={45} />
        <Tooltip
          formatter={(v: number) => [formatCurrency(v), "Spent"]}
          contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
        />
        <Line type="monotone" dataKey="amount" stroke="#1E3A5F" strokeWidth={2} dot={false} animationDuration={600} />
      </LineChart>
    </ResponsiveContainer>
  );
}
