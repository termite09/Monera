"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { monthlyCategoryTotals } from "@/lib/reports";
import { MONTH_NAMES } from "@/config/constants";

interface YearBarProps {
  transactions: Transaction[];
  year: number;
  paydayOfMonth?: number;
  onMonthClick?: (monthKey: string) => void;
}

export function YearBar({ transactions, year, paydayOfMonth = 1, onMonthClick }: YearBarProps) {
  const totals = monthlyCategoryTotals(transactions, year, paydayOfMonth);
  const data = MONTH_NAMES.map((name, idx) => ({
    month: name.slice(0, 3),
    monthKey: `${year}-${String(idx + 1).padStart(2, "0")}`,
    ...totals[idx],
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          style={onMonthClick ? { cursor: "pointer" } : undefined}
          onClick={onMonthClick ? (chartData) => {
            const idx = chartData?.activeTooltipIndex;
            if (typeof idx === "number" && data[idx]?.monthKey) onMonthClick(data[idx].monthKey);
          } : undefined}
        >
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
      <div className="flex items-center gap-3 mt-1 px-1 justify-end">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block size-2 rounded-sm bg-[#1E3A5F]" /> Needs
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block size-2 rounded-sm bg-[#D97706]" /> Wants
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block size-2 rounded-sm bg-[#059669]" /> Savings
        </span>
      </div>
    </div>
  );
}
