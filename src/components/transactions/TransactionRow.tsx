"use client";

import { useState, useRef, useEffect } from "react";
import { Repeat, Loader2, Pencil } from "lucide-react";
import { Transaction } from "@/types";
import { formatCurrency, cleanDescription, cn, getCategoryTextClass, getCategorySwatchClass, toDateStr } from "@/lib/utils";

interface TransactionRowProps {
  transaction: Transaction;
  onDelete?: (id: string) => void | Promise<void>;
  onEdit?: (id: string) => void;
  selectMode?: boolean;
  checked?: boolean;
  /** `range` is true for shift-click, to select everything since the last pick. */
  onCheck?: (id: string, range?: boolean) => void;
  /** Opens the "Move to…" choice for this one transaction. */
  onCategory?: (tx: Transaction) => void;
  showCategory?: boolean;
}

const THIS_YEAR = new Date().getFullYear();

function parseDateParts(dateStr: string): { dayMonth: string; year: string | null } {
  const d = new Date(dateStr + "T00:00:00");
  return {
    // en-GB writes "Sept"; three letters keeps the date column narrow and even.
    dayMonth: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace("Sept", "Sep"),
    // Only worth the space when it isn't this year.
    year: d.getFullYear() === THIS_YEAR ? null : String(d.getFullYear()),
  };
}

export function TransactionRow({
  transaction,
  onDelete,
  onEdit,
  selectMode = false,
  checked = false,
  onCheck,
  onCategory,
  showCategory = true,
}: TransactionRowProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (autoHideRef.current) clearTimeout(autoHideRef.current); }, []);

  const tx = transaction;
  const isIncome = tx.type === "income";
  const isRecurring = tx.source === "recurring";
  const excluded = !!tx.excluded;
  const { dayMonth, year } = parseDateParts(tx.date);
  // Future-dated rows (bills still to come) are listed but don't count yet.
  const isUpcoming = tx.date > toDateStr(new Date());

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className={cn(
        "flex w-full items-start gap-1.5 sm:gap-3 py-2.5 px-1.5 sm:px-2 transition-colors",
        excluded ? "opacity-50 bg-muted/30" : selectMode ? "cursor-pointer hover:bg-secondary/30" : "hover:bg-secondary/50",
        checked && "bg-primary/5"
      )}
      // Mouse convenience in select mode; the checkbox is the keyboard route.
      onClick={selectMode && !excluded ? (e) => onCheck?.(tx.id, e.shiftKey) : undefined}
    >
      {/* Date — day+month on top, year below when it isn't this year */}
      <div className="shrink-0 w-12 sm:w-14 pt-0.5 flex flex-col leading-tight">
        <span className="text-xs text-muted-foreground tabular-nums font-mono">{dayMonth}</span>
        {year && <span className="text-xs text-muted-foreground tabular-nums font-mono">{year}</span>}
      </div>

      {/* Description + optional notes and, for your own entries, edit/delete */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 pt-0.5">
        <span className={cn("flex items-start gap-1.5 text-sm text-foreground min-w-0", excluded && "line-through")}>
          {isRecurring && (
            <Repeat size={12} className="text-muted-foreground shrink-0 mt-0.5" role="img" aria-label="Regular bill" />
          )}
          <span className="min-w-0 break-words">{cleanDescription(tx.description)}</span>
        </span>
        {isUpcoming && (
          <span className="text-xs font-medium text-muted-foreground">Upcoming</span>
        )}
        {tx.notes && <span className="text-xs text-muted-foreground break-words">{tx.notes}</span>}
        {tx.source === "manual" && (
          <span className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2" onClick={stop}>
            Added by you
            {onEdit && !confirmDelete && (
              <button type="button" onClick={() => onEdit(tx.id)} className="tap-area underline underline-offset-2 hover:text-foreground">
                Edit
              </button>
            )}
            {onDelete && (confirmDelete ? (
              <>
                <button
                  type="button"
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
                  className="tap-area inline-flex items-center gap-1 font-medium text-destructive underline underline-offset-2 disabled:cursor-wait"
                >
                  {deleting && <Loader2 size={12} className="animate-spin" aria-hidden />}
                  Delete for good
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="tap-area underline underline-offset-2 hover:text-foreground">
                  Keep
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(true);
                  // Auto-dismiss after a few seconds if not confirmed — fallback for mobile
                  if (autoHideRef.current) clearTimeout(autoHideRef.current);
                  autoHideRef.current = setTimeout(() => setConfirmDelete(false), 5000);
                }}
                className="tap-area underline underline-offset-2 hover:text-foreground"
              >
                Delete
              </button>
            ))}
          </span>
        )}
      </div>

      {/* Category — a fixed, left-aligned column so every swatch lines up. Always
          rendered (invisible when hidden) to keep the columns stable. */}
      <div className={cn("flex shrink-0 w-15 sm:w-24 pt-0.5 justify-start", !showCategory && "invisible pointer-events-none")}>
        {!isIncome && (
          onCategory && !excluded && !selectMode && !isRecurring ? (
            <button
              type="button"
              onClick={(e) => { stop(e); onCategory(tx); }}
              aria-label={`Category: ${tx.category === "Uncategorized" ? "none" : tx.category}. Change`}
              className="-mx-1 -my-0.5 px-1 py-0.5 rounded-md hover:bg-secondary transition-colors"
            >
              <CategoryLabel tx={tx} />
            </button>
          ) : (
            <CategoryLabel tx={tx} />
          )
        )}
      </div>

      {/* Amount — fixed width, right-aligned, so the column edge is straight. */}
      <span
        className={cn(
          "shrink-0 w-18 sm:w-24 pt-0.5 text-sm tabular-nums text-right font-mono whitespace-nowrap",
          excluded ? "line-through text-muted-foreground" : "text-foreground"
        )}
      >
        {isIncome ? "+" : "−"}{formatCurrency(tx.amount)}
      </span>

      {/* Selection — the same column on every row */}
      <label className="shrink-0 w-11 sm:w-12 min-h-11 -my-3 flex items-center justify-center cursor-pointer" onClick={stop}>
        {onCheck && (
          <input
            type="checkbox"
            checked={checked}
            onChange={() => { /* handled in onClick so shift-click works */ }}
            onClick={(e) => onCheck(tx.id, e.shiftKey)}
            aria-label={`Select ${cleanDescription(tx.description)}, ${isIncome ? "+" : "−"}${formatCurrency(tx.amount)}`}
            className="size-4 cursor-pointer accent-primary rounded-sm"
          />
        )}
      </label>
    </div>
  );
}

function CategoryLabel({ tx }: { tx: Transaction }) {
  return (
    <span className={cn("text-xs font-medium whitespace-nowrap inline-flex items-center gap-1 sm:gap-1.5", getCategoryTextClass(tx.category))}>
      <span className={cn("size-2 rounded-sm shrink-0", getCategorySwatchClass(tx.category))} aria-hidden />
      {tx.category === "Uncategorized" ? (
        <><span className="sm:hidden">None</span><span className="hidden sm:inline">No category</span></>
      ) : tx.category}
      {tx.categorySource === "override" && (
        <Pencil size={10} className="hidden sm:inline text-muted-foreground" aria-label="Set by you — rules won't change it" role="img" />
      )}
    </span>
  );
}
