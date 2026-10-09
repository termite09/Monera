"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { cn, formatCurrency, getCategoryColor, getDisplayCurrency } from "@/lib/utils";
import { InfoIcon } from "@/components/ui/InfoIcon";
import type { Category } from "@/types";

interface BudgetDonutProps {
  category: Extract<Category, "Needs" | "Wants" | "Savings">;
  spent: number;
  allocated: number;
  info?: string;
  /** No statement covers this period yet: show the budget, not "left". */
  expected?: boolean;
  /** Bills (or savings transfers) in this category still to come before payday. */
  due?: number;
  onClick?: () => void;
}

function centerAmount(n: number): string {
  if (n >= 10000) return `${getDisplayCurrency()}${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return formatCurrency(n);
}

function amountFontSize(s: string): string {
  if (s.length <= 6) return "text-base sm:text-lg";
  if (s.length <= 8) return "text-sm sm:text-base";
  return "text-xs sm:text-sm";
}

// Internal SVG coordinate space; the <svg> scales to its container via viewBox.
const VB = 116;
const STROKE = 13;

export function BudgetDonut({ category, spent, allocated, info, expected = false, due = 0, onClick }: BudgetDonutProps) {
  const router = useRouter();
  const isSavings = category === "Savings";
  const color = getCategoryColor(category);
  // "Left" means left after the bills already committed this period, so the
  // circles add up to Safe to spend instead of disagreeing with it.
  // Savings only counts money actually moved; a scheduled transfer hasn't happened yet.
  const committed = isSavings ? spent : spent + due;
  const ratio = allocated > 0 ? committed / allocated : 0;
  const pct = Math.min(ratio, 1);

  // Spending budgets go red over the limit. Savings is a target, so going past
  // it is good news, never a warning.
  const status: "over" | "met" | null =
    allocated <= 0 || expected ? null
    : isSavings ? (committed >= allocated ? "met" : null)
    : committed > allocated ? "over"
    : null;

  const r = (VB - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const dash = pct * c;
  const arcColor = status === "over" ? "var(--destructive)" : color;

  const remaining = Math.max(0, allocated - committed);
  const display = allocated > 0
    ? centerAmount(expected ? allocated : status === "over" ? committed - allocated : status === "met" ? committed : remaining)
    : "—";
  const caption = allocated <= 0 ? null
    : expected ? "budget"
    : status === "over" ? "over"
    : isSavings ? (status === "met" ? "saved" : "to target")
    : "left";

  const spoken = (allocated <= 0
    ? `${category}: no budget set`
    : expected
      ? `${category}: ${formatCurrency(allocated)} budget, no statement yet`
    : status === "over"
      ? `${category}: ${formatCurrency(committed - allocated)} over a ${formatCurrency(allocated)} budget`
      : isSavings
        ? `${category}: ${formatCurrency(spent)} saved of a ${formatCurrency(allocated)} target`
        : `${category}: ${formatCurrency(remaining)} left of ${formatCurrency(allocated)}`
  ) + (!expected && !isSavings && due > 0 ? `, after ${formatCurrency(due)} in bills due` : "");

  const infoText = allocated === 0 && info
    ? `${info} Go to Settings → Basics to set your budget split.`
    : info;

  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm shrink-0" style={{ background: color }} aria-hidden />
        <p className="text-sm font-semibold text-foreground">{category}</p>
        {allocated === 0 && infoText && (
          <InfoIcon content={infoText} side="top" onClick={() => router.push("/settings?tab=setup")} />
        )}
      </div>

      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        aria-label={onClick ? `${spoken}. Show transactions` : spoken}
        className="relative w-full max-w-45 aspect-square rounded-full cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full h-full block" aria-hidden>
          <circle cx={VB / 2} cy={VB / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={STROKE} />
          {!expected && allocated > 0 && pct > 0.005 && (
            <circle
              cx={VB / 2}
              cy={VB / 2}
              r={r}
              fill="none"
              stroke={arcColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
              transform={`rotate(-90 ${VB / 2} ${VB / 2})`}
              className="motion-safe:transition-[stroke-dasharray] motion-safe:duration-500"
            />
          )}
        </svg>

        <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1" aria-hidden>
          <span className={cn(
            "font-mono tabular-nums font-medium leading-none text-center",
            amountFontSize(display),
            status === "over" ? "text-destructive" : allocated > 0 ? "text-foreground" : "text-muted-foreground"
          )}>
            {display}
          </span>
          {caption && <span className="text-xs text-muted-foreground leading-none mt-1">{caption}</span>}
        </span>
      </button>

      {status === "over" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-status-over-bg px-2 py-0.5 text-xs font-medium text-status-over">
          <AlertCircle size={12} aria-hidden />
          Over budget
        </span>
      )}
      {status === "met" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-status-ok-bg px-2 py-0.5 text-xs font-medium text-status-ok">
          <Check size={12} aria-hidden />
          Target met
        </span>
      )}
    </div>
  );
}
