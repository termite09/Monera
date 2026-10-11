"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface SummaryCardProps {
  label: string;
  /** null = no figure to show yet (e.g. no statement for this period). */
  amount: number | null;
  /** "hero" is the one tile that answers the screen's question (safe to spend). */
  variant?: "hero" | "default";
  /** Prefix shown before the amount, e.g. "+" for money coming in. */
  sign?: string;
  /** Plain-language line under the amount (hero only). */
  sentence?: ReactNode;
  /** Small supporting line under the sentence, e.g. how current the data is (hero only). */
  note?: ReactNode;
  /** Red when the figure means "over" — the only colour a tile ever takes. */
  negative?: boolean;
  className?: string;
  onClick?: () => void;
}

export function SummaryCard({
  label,
  amount,
  variant = "default",
  sign = "",
  sentence,
  note,
  negative = false,
  className,
  onClick,
}: SummaryCardProps) {
  const shouldReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // A money figure shows its real value straight away; it never counts up from
  // €0 through wrong amounts. When it changes (another pay period), it moves
  // from the old value to the new one, so the change itself is visible.
  const [displayed, setDisplayed] = useState(amount ?? 0);
  const shownRef = useRef(amount ?? 0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const from = shownRef.current;
    const to = amount ?? 0;
    const show = (v: number) => { shownRef.current = v; setDisplayed(v); };
    if (shouldReduceMotion || from === to) { show(to); return; }
    const start = performance.now();
    const duration = 400;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      show(from + (to - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [amount, shouldReduceMotion]);
  const hero = variant === "hero";
  // The full figure for screen readers — the visible one may be moving.
  const prefix = amount !== null && amount < 0 ? "−" : sign;
  const spoken = amount === null ? label : `${label}: ${prefix}${formatCurrency(Math.abs(amount))}`;

  return (
    // No entrance of its own: the page already eases in once.
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        aria-label={onClick ? `${spoken}. Show details` : spoken}
        className={cn(
          "w-full h-full text-left rounded-xl border border-border bg-card flex flex-col transition-colors",
          "hover:bg-secondary/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // Supporting tiles sit in a row of three on phones and stack as compact
          // label-and-figure rows beside the hero on wider screens.
          hero ? "p-5 gap-1.5 md:px-6" : "p-3 gap-1.5 sm:p-4 md:flex-row md:items-center md:gap-3 md:px-5 md:py-3"
        )}
      >
        <span className={cn("flex items-center font-semibold text-foreground text-sm", hero ? "w-full" : "w-full md:w-auto md:flex-1")}>
          {label}
          {onClick && <ChevronRight size={14} className={cn("ml-auto text-muted-foreground shrink-0", !hero && "md:hidden")} aria-hidden />}
        </span>
        <span
          aria-hidden
          className={cn(
            "font-mono tabular-nums font-medium leading-tight",
            hero ? "text-3xl sm:text-4xl tracking-[-0.01em]" : "text-sm sm:text-lg",
            negative ? "text-destructive" : "text-foreground"
          )}
        >
          {amount === null ? "—" : <>{prefix}{formatCurrency(Math.abs(displayed))}</>}
        </span>
        {hero && sentence && (
          <span className="text-base leading-relaxed text-foreground/80 max-w-[52ch]">{sentence}</span>
        )}
        {hero && note && <span className="text-xs text-muted-foreground">{note}</span>}
        {!hero && onClick && <ChevronRight size={14} className="hidden md:block text-muted-foreground shrink-0" aria-hidden />}
      </button>
    </div>
  );
}
