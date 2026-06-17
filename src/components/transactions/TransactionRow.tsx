"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { Transaction, Category } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface TransactionRowProps {
  transaction: Transaction;
  onCategoryChange: (id: string, category: Category) => void;
}

const CATEGORIES: Category[] = ["Needs", "Wants", "Savings", "Uncategorized"];

const catDot: Record<Category, string> = {
  Needs: "bg-blue-500",
  Wants: "bg-amber-500",
  Savings: "bg-emerald-500",
  Uncategorized: "bg-muted-foreground/40",
};

const catText: Record<Category, string> = {
  Needs: "text-blue-600 dark:text-blue-400",
  Wants: "text-amber-600 dark:text-amber-400",
  Savings: "text-emerald-600 dark:text-emerald-400",
  Uncategorized: "text-muted-foreground",
};

function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function TransactionRow({ transaction, onCategoryChange }: TransactionRowProps) {
  const [editing, setEditing] = useState(false);
  const tx = transaction;
  const isIncome = tx.type === "income";
  const isRecurring = tx.source === "recurring";

  return (
    <div className="grid grid-cols-[2.8rem_1fr_auto_auto] items-center gap-2 sm:gap-3 py-2 px-2 hover:bg-secondary/50 transition-colors">
      <span className="text-xs text-muted-foreground tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>
        {shortDate(tx.date)}
      </span>

      <span className="truncate text-sm text-foreground flex items-center gap-1.5 min-w-0">
        {isRecurring && <Repeat size={12} className="text-muted-foreground shrink-0" />}
        <span className="truncate">{tx.description}</span>
      </span>

      <div className="justify-self-start">
        {editing ? (
          <select
            value={tx.category}
            onChange={(e) => {
              onCategoryChange(tx.id, e.target.value as Category);
              setEditing(false);
            }}
            onBlur={() => setEditing(false)}
            autoFocus
            className="text-xs border border-input rounded-md px-1.5 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring h-7"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 focus:outline-none"
            aria-label={`Category: ${tx.category}`}
          >
            <span className={cn("size-2 rounded-full shrink-0", catDot[tx.category])} />
            <span className={cn("hidden sm:inline text-xs font-medium", catText[tx.category])}>{tx.category}</span>
          </button>
        )}
      </div>

      <span
        className={cn(
          "text-sm tabular-nums text-right justify-self-end",
          isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
        )}
        style={{ fontFamily: "'DM Mono', monospace" }}
      >
        {isIncome ? "+" : "−"}{formatCurrency(tx.amount)}
      </span>
    </div>
  );
}
