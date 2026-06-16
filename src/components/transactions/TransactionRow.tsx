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
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {transaction.description}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {formatDate(transaction.date)}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
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
          <button onClick={() => setEditing(true)} className="focus:outline-none">
            <CategoryBadge category={transaction.category} />
          </button>
        )}

        <SourceBadge source={transaction.source} />

        <span className={`text-sm font-semibold tabular-nums ${
          transaction.type === "income"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-gray-900 dark:text-white"
        }`}>
          {transaction.type === "income" ? "+" : "-"}
          {formatCurrency(transaction.amount)}
        </span>
      </div>
    </div>
  );
}
