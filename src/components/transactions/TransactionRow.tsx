"use client";

import { useState } from "react";
import { Transaction, Category } from "@/types";
import { CategoryBadge, SourceBadge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface TransactionRowProps {
  transaction: Transaction;
  onCategoryChange: (id: string, category: Category) => void;
}

const CATEGORIES: Category[] = ["Needs", "Wants", "Savings", "Uncategorized"];

export function TransactionRow({ transaction, onCategoryChange }: TransactionRowProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-lg">
      {/* Top row: description + amount */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
          {transaction.description}
        </p>
        <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
          transaction.type === "income"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-gray-900 dark:text-white"
        }`}>
          {transaction.type === "income" ? "+" : "-"}
          {formatCurrency(transaction.amount)}
        </span>
      </div>

      {/* Bottom row: date + badges */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <span className="text-xs text-gray-400">{formatDate(transaction.date)}</span>

        {editing ? (
          <select
            value={transaction.category}
            onChange={(e) => {
              onCategoryChange(transaction.id, e.target.value as Category);
              setEditing(false);
            }}
            onBlur={() => setEditing(false)}
            autoFocus
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <button onClick={() => setEditing(true)} className="focus:outline-none min-h-[28px] flex items-center">
            <CategoryBadge category={transaction.category} />
          </button>
        )}

        <span className="hidden sm:inline-flex">
          <SourceBadge source={transaction.source} />
        </span>
      </div>
    </div>
  );
}
