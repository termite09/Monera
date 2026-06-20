"use client";

import { useState } from "react";
import { Repeat, EyeOff, RotateCcw, Loader2, Trash2 } from "lucide-react";
import { Transaction, Category } from "@/types";
import { formatCurrency, cleanDescription, cn } from "@/lib/utils";

interface TransactionRowProps {
  transaction: Transaction;
  onCategoryChange: (id: string, category: Category) => void | Promise<void>;
  onToggleExclude?: (id: string) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  selectMode?: boolean;
  checked?: boolean;
  onCheck?: (id: string) => void;
  showCategory?: boolean;
}

const CATEGORIES: Category[] = ["Needs", "Wants", "Savings", "Uncategorized"];

const catText: Record<Category, string> = {
  Needs: "text-blue-600 dark:text-blue-400",
  Wants: "text-amber-600 dark:text-amber-400",
  Savings: "text-emerald-600 dark:text-emerald-400",
  Uncategorized: "text-muted-foreground",
};

// Shown on small screens so category is never conveyed by color alone (a11y).
const catShort: Record<Category, string> = {
  Needs: "Needs",
  Wants: "Wants",
  Savings: "Savings",
  Uncategorized: "Uncat.",
};

function parseDateParts(dateStr: string): { dayMonth: string; year: string } {
  const d = new Date(dateStr + "T00:00:00");
  return {
    dayMonth: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    year: String(d.getFullYear()),
  };
}

export function TransactionRow({
  transaction,
  onCategoryChange,
  onToggleExclude,
  onDelete,
  selectMode = false,
  checked = false,
  onCheck,
  showCategory = true,
}: TransactionRowProps) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const tx = transaction;
  const isIncome = tx.type === "income";
  const isRecurring = tx.source === "recurring";
  const excluded = !!tx.excluded;
  const { dayMonth, year } = parseDateParts(tx.date);

  return (
    <div
      className={cn(
        "flex w-full items-start gap-2 sm:gap-3 py-2.5 px-2 transition-colors",
        excluded ? "opacity-50 bg-muted/30" : selectMode ? "cursor-pointer hover:bg-secondary/30" : "hover:bg-secondary/50",
        checked && "bg-primary/5"
      )}
      onClick={selectMode && !excluded ? () => onCheck?.(tx.id) : undefined}
    >
      {/* Date — day+month on top, year below in muted smaller text */}
      <div className="shrink-0 w-14 pt-0.5 flex flex-col leading-tight">
        <span className="text-xs text-muted-foreground tabular-nums font-mono">{dayMonth}</span>
        <span className="text-[10px] text-muted-foreground/50 tabular-nums font-mono">{year}</span>
      </div>

      {/* Description + optional notes */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 pt-0.5">
        <span className={cn("flex items-start gap-1.5 text-sm text-foreground min-w-0", excluded && "line-through")}>
          {isRecurring && <Repeat size={12} className="text-muted-foreground shrink-0 mt-0.5" />}
          <span className="min-w-0 wrap-break-word">{cleanDescription(tx.description)}</span>
        </span>
        {tx.notes && <span className="text-xs text-muted-foreground wrap-break-word">{tx.notes}</span>}
      </div>

      {/* Category — always rendered to keep column layout stable; hidden via
          visibility when showCategory is false so width is preserved. */}
      <div className={cn("shrink-0 w-24 pt-0.5 flex justify-end", !showCategory && "invisible pointer-events-none")}>
        {!isIncome && (editing && !excluded && !selectMode ? (
          <select
            value={tx.category}
            onChange={(e) => {
              onCategoryChange(tx.id, e.target.value as Category);
              setEditing(false);
            }}
            onBlur={() => setEditing(false)}
            autoFocus
            className="w-24 text-xs border border-input rounded-md px-1.5 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring h-7"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : !isIncome ? (
          <button
            onClick={selectMode ? undefined : () => !excluded && setEditing(true)}
            disabled={excluded || selectMode}
            className="text-right focus:outline-none disabled:cursor-default whitespace-nowrap"
            aria-label={`Category: ${tx.category}`}
          >
            <span className={cn("text-xs font-medium", catText[tx.category])}>
              <span className="sm:hidden">{catShort[tx.category]}</span>
              <span className="hidden sm:inline">{tx.category}</span>
            </span>
          </button>
        ) : null)}
      </div>

      {/* Amount — hugs content (min floor for short amounts) so it sits tight
          against the category instead of reserving a wide fixed column. */}
      <span
        className={cn(
          "shrink-0 min-w-14 pt-0.5 text-sm tabular-nums text-right font-mono whitespace-nowrap",
          excluded ? "line-through text-muted-foreground" : isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
        )}
      >
        {isIncome ? "+" : "−"}{formatCurrency(tx.amount)}
      </span>

      {/* Right action: checkbox when selection is available, otherwise eye/delete */}
      {onCheck ? (
        <div
          className="shrink-0 w-6 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); onCheck(tx.id); }}
        >
          <div className={cn(
            "size-4 rounded-full border-2 flex items-center justify-center transition-colors",
            checked ? "border-primary bg-primary" : selectMode ? "border-input" : "border-input/30 hover:border-input"
          )}>
            {checked && <div className="size-2 rounded-full bg-white" />}
          </div>
        </div>
      ) : onToggleExclude ? (
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
            "shrink-0 p-1 rounded-md transition-colors disabled:cursor-wait",
            excluded ? "text-primary hover:bg-secondary" : "text-muted-foreground/40 hover:text-destructive hover:bg-secondary"
          )}
          aria-label={excluded ? "Include in calculations" : "Exclude from calculations"}
          title={excluded ? "Include in calculations" : "Exclude from calculations"}
        >
          {toggling ? <Loader2 size={14} className="animate-spin" /> : excluded ? <RotateCcw size={14} /> : <EyeOff size={14} />}
        </button>
      ) : onDelete ? (
        confirmDelete ? (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={async () => {
              if (deleting) return;
              setDeleting(true);
              try {
                await onDelete(tx.id);
              } catch {
                // Handled upstream; reset UI so the row doesn't stay spinning.
              } finally {
                setDeleting(false);
                setConfirmDelete(false);
              }
            }}
            disabled={deleting}
            className="shrink-0 p-1 rounded-md text-destructive bg-destructive/10 transition-colors disabled:cursor-wait hover:bg-destructive/20"
            aria-label="Confirm delete"
            title="Tap again to confirm"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            onBlur={() => setConfirmDelete(false)}
            className="shrink-0 p-1 rounded-md text-muted-foreground/30 transition-colors hover:text-destructive hover:bg-secondary"
            aria-label="Delete transaction"
            title="Delete manual transaction"
          >
            <Trash2 size={14} />
          </button>
        )
      ) : null}
    </div>
  );
}
