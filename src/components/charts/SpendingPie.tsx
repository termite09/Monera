"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Transaction } from "@/types";
import { getCategoryColor, formatCurrency } from "@/lib/utils";

interface SpendingPieProps {
  transactions: Transaction[];
}

export function SpendingPie({ transactions }: SpendingPieProps) {
  const expenses = transactions.filter((t) => t.type === "expense");

  const data = ["Needs", "Wants", "Savings", "Uncategorized"].map((cat) => ({
    name: cat,
    value: expenses
      .filter((t) => t.category === cat)
      .reduce((s, t) => s + t.amount, 0),
  })).filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        No expense data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          animationBegin={0}
          animationDuration={600}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={getCategoryColor(entry.name as "Needs" | "Wants" | "Savings" | "Uncategorized")} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatCurrency(value as number)}
          contentStyle={{
            background: "var(--card-bg, #fff)",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: "12px", color: "#6B7280" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
