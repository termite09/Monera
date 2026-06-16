"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { MONTH_NAMES } from "@/config/constants";

interface YearBarProps {
  transactions: Transaction[];
  year: number;
}

export function YearBar({ transactions, year }: YearBarProps) {
  const data = MONTH_NAMES.map((name, idx) => {
    const month = `${year}-${String(idx + 1).padStart(2, "0")}`;
    const monthTxs = transactions.filter((t) => t.month === month && t.type === "expense");
    return {
      month: name.slice(0, 3),
      needs: monthTxs.filter((t) => t.category === "Needs").reduce((s, t) => s + t.amount, 0),
      wants: monthTxs.filter((t) => t.category === "Wants").reduce((s, t) => s + t.amount, 0),
      savings: monthTxs.filter((t) => t.category === "Savings").reduce((s, t) => s + t.amount, 0),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} width={45} />
        <Tooltip
          formatter={(v) => formatCurrency(v as number)}
          contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
        />
        <Bar dataKey="needs" stackId="a" fill="#1E3A5F" name="Needs" radius={[0, 0, 0, 0]} animationDuration={600} />
        <Bar dataKey="wants" stackId="a" fill="#D97706" name="Wants" animationDuration={600} />
        <Bar dataKey="savings" stackId="a" fill="#059669" name="Savings" radius={[4, 4, 0, 0]} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}
