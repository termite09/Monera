"use client";

import { useState } from "react";
import { Repeat, EyeOff, RotateCcw, Loader2, Trash2 } from "lucide-react";
import { Transaction, Category } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface TransactionRowProps {
  transaction: Transaction;
  onCategoryChange: (id: string, category: Category) => void;
  onToggleExclude?: (id: string) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
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

export function TransactionRow({ transaction, onCategoryChange, onToggleExclude, onDelete }: TransactionRowProps) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tx = transaction;
  const isIncome = tx.type === "income";
  const isRecurring = tx.source === "recurring";
  const excluded = !!tx.excluded;

  return (
    <div
      className={cn(
        "grid items-center gap-2 sm:gap-3 py-2 px-2 transition-colors",
        onDelete
          ? "grid-cols-[2.8rem_1fr_auto_auto_1.75rem_1.75rem]"
          : "grid-cols-[2.8rem_1fr_auto_auto_1.75rem]",
        excluded ? "opacity-50 bg-muted/30" : "hover:bg-secondary/50"
      )}
    >
      <span className="text-xs text-muted-foreground tabular-nums font-mono">
        {shortDate(tx.date)}
      </span>

      <span className={cn("truncate text-sm text-foreground flex items-center gap-1.5 min-w-0", excluded && "line-through")}>
        {isRecurring && <Repeat size={12} className="text-muted-foreground shrink-0" />}
        <span className="truncate">{tx.description}</span>
      </span>

      <div className="justify-self-start">
        {editing && !excluded ? (
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
            onClick={() => !excluded && setEditing(true)}
            disabled={excluded}
            className="flex items-center gap-1.5 focus:outline-none disabled:cursor-default"
            aria-label={`Category: ${tx.category}`}
          >
            <span className={cn("size-2 rounded-full shrink-0", catDot[tx.category])} />
            <span className={cn("hidden sm:inline text-xs font-medium", catText[tx.category])}>{tx.category}</span>
          </button>
        )}
      </div>

      <span
        className={cn(
          "text-sm tabular-nums text-right justify-self-end font-mono",
          excluded ? "line-through text-muted-foreground" : isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
        )}
      >
        {isIncome ? "+" : "−"}{formatCurrency(tx.amount)}
      </span>

      {onToggleExclude && (
        <button
          onClick={async () => {
            if (toggling) return;
            setToggling(true);
            try {
              await onToggleExclude(tx.id);
            } finally {
              setToggling(false);
            }
          }}
          disabled={toggling}
          className={cn(
            "justify-self-end p-1 rounded-md transition-colors disabled:cursor-wait",
            excluded ? "text-primary hover:bg-secondary" : "text-muted-foreground/40 hover:text-destructive hover:bg-secondary"
          )}
          aria-label={excluded ? "Include in calculations" : "Exclude from calculations"}
          title={excluded ? "Include in calculations" : "Exclude from calculations"}
        >
          {toggling ? <Loader2 size={14} className="animate-spin" /> : excluded ? <RotateCcw size={14} /> : <EyeOff size={14} />}
        </button>
      )}

      {onDelete && (
        confirmDelete ? (
          <button
            onClick={async () => {
              if (deleting) return;
              setDeleting(true);
              try {
                await onDelete(tx.id);
              } finally {
                setDeleting(false);
                setConfirmDelete(false);
              }
            }}
            disabled={deleting}
            className="justify-self-end p-1 rounded-md text-destructive bg-destructive/10 transition-colors disabled:cursor-wait hover:bg-destructive/20"
            aria-label="Confirm delete"
            title="Tap again to confirm"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            onBlur={() => setConfirmDelete(false)}
            className="justify-self-end p-1 rounded-md text-muted-foreground/30 transition-colors hover:text-destructive hover:bg-secondary"
            aria-label="Delete transaction"
            title="Delete manual transaction"
          >
            <Trash2 size={14} />
          </button>
        )
      )}
    </div>
  );
}
