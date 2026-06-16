"use client";

import { useState } from "react";
import { Transaction, Category } from "@/types";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface TransactionRowProps {
  transaction: Transaction;
  onCategoryChange: (id: string, category: Category) => void;
}

const CATEGORIES: Category[] = ["Needs", "Wants", "Savings", "Uncategorized"];

const categoryStyles: Record<Category, string> = {
  Needs: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  Wants: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  Savings: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  Uncategorized: "bg-muted text-muted-foreground border-border",
};

export function TransactionRow({ transaction, onCategoryChange }: TransactionRowProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="py-3 px-4 hover:bg-secondary/50 transition-colors rounded-lg">
      {/* Top row: description + amount */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-foreground truncate flex-1">
          {transaction.description}
        </p>
        <span
          className={cn(
            "text-sm font-medium flex-shrink-0 tabular-nums",
            transaction.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
          )}
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          {transaction.type === "income" ? "+" : "−"}
          {formatCurrency(transaction.amount)}
        </span>
      </div>

      {/* Bottom row: date + badges */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground">{formatDate(transaction.date)}</span>

        {editing ? (
          <select
            value={transaction.category}
            onChange={(e) => {
              onCategoryChange(transaction.id, e.target.value as Category);
              setEditing(false);
            }}
            onBlur={() => setEditing(false)}
            autoFocus
            className="text-xs border border-input rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring h-7"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <button onClick={() => setEditing(true)} className="focus:outline-none min-h-[28px] flex items-center">
            <Badge variant="outline" className={cn("text-xs font-medium cursor-pointer", categoryStyles[transaction.category])}>
              {transaction.category}
            </Badge>
          </button>
        )}

        <span className="hidden sm:inline-flex">
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              transaction.source === "revolut"
                ? "bg-blue-50 text-[#0075EB] border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800"
            )}
          >
            {transaction.source === "revolut" ? "Revolut" : "Manual"}
          </Badge>
        </span>
      </div>
    </div>
  );
}
