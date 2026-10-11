"use client";

import { useRouter } from "next/navigation";
import { formatCurrency, formatShortDate, getDisplayCurrency } from "@/lib/format";
import { getCategoryColor } from "@/lib/categories";
import { cn } from "@/lib/utils";
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
  /** The date it's due, when it's a single bill. */
  dueOn?: string | null;
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

/**
 * A dash pattern drawing `length` of the ring as short ticks, then nothing for
 * the rest of the circumference `c` (SVG can't limit a repeating pattern).
 */
function ticksDasharray(length: number, c: number): string {
  const TICK = 2.5;
  const GAP = 2.5;
  if (length <= 0) return `0 ${c}`;
  const parts: number[] = [];
  for (let left = length; left > 0; ) {
    parts.push(Math.min(TICK, left));
    left -= TICK;
    if (left <= 0) break;
    parts.push(Math.min(GAP, left));
    left -= GAP;
  }
  // Ends on a gap that runs round the rest of the circle.
  if (parts.length % 2 === 1) parts.push(c);
  else parts[parts.length - 1] += c;
  return parts.join(" ");
}

// Internal SVG coordinate space; the <svg> scales to its container via viewBox.
const VB = 116;
const STROKE = 13;

export function BudgetDonut({ category, spent, allocated, info, expected = false, due = 0, dueOn = null, onClick }: BudgetDonutProps) {
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
  // Two marks: money already spent is a solid arc; bills still due continue it as
  // ticks (scheduled, not spent), so a ring that's mostly rent-to-come doesn't
  // look like overspending.
  const dash = pct * c;
  const spentDash = Math.min(allocated > 0 ? spent / allocated : 0, 1) * c;
  const arcColor = status === "over" ? "var(--destructive)" : color;
  // Bills show as ticks whenever some of the ring is theirs — over budget too,
  // where they're what tipped it over, not money already gone.
  const showsDue = !isSavings && due > 0 && !expected && dash - spentDash > 0.005 * c;
  const dueTicks = ticksDasharray(dash - spentDash, c);
  const overOnlyFromBills = status === "over" && spent <= allocated;
  const arcProps = {
    cx: VB / 2, cy: VB / 2, r, fill: "none", strokeWidth: STROKE, strokeLinecap: "round" as const,
    transform: `rotate(-90 ${VB / 2} ${VB / 2})`,
    className: "motion-safe:transition-[stroke-dasharray] motion-safe:duration-500 motion-safe:ease-out",
  };

  const remaining = Math.max(0, allocated - committed);
  const display = allocated > 0
    ? centerAmount(expected ? allocated : status === "over" ? committed - allocated : status === "met" ? committed : remaining)
    : "—";
  const caption = allocated <= 0 ? null
    : expected ? "budget"
    : status === "over" ? (overOnlyFromBills ? "over after bills" : "over")
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
          <InfoIcon content={infoText} side="top" onClick={() => router.push("/settings?tab=basics")} />
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
            showsDue ? (
              <>
                <circle {...arcProps} strokeLinecap="butt" stroke={arcColor} strokeOpacity={0.6} strokeDasharray={dueTicks} strokeDashoffset={-spentDash} />
                {spentDash > 0.005 * c && <circle {...arcProps} stroke={arcColor} strokeDasharray={`${spentDash} ${c - spentDash}`} />}
              </>
            ) : (
              <circle {...arcProps} stroke={arcColor} strokeDasharray={`${dash} ${c - dash}`} />
            )
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

      {/* The key to the ticked part of the ring. */}
      {showsDue && (
        <p className="flex items-start justify-center gap-1.5 text-xs text-muted-foreground text-center leading-snug" aria-hidden>
          <svg viewBox="0 0 12 8" className="w-3 h-2 shrink-0 mt-1" aria-hidden>
            {[0, 4.5, 9].map((x) => <rect key={x} x={x} width="2.5" height="8" fill={arcColor} opacity={0.6} />)}
          </svg>
          <span>
            <span className="font-mono tabular-nums">{formatCurrency(due)}</span> due {dueOn ? formatShortDate(dueOn) : "by payday"}
          </span>
        </p>
      )}
    </div>
  );
}
