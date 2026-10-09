"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  /** null = no figure to show yet (e.g. no statement for this period). */
  amount: number | null;
  index: number;
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
  index,
  variant = "default",
  sign = "",
  sentence,
  note,
  negative = false,
  className,
  onClick,
}: SummaryCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [animated, setAnimated] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (shouldReduceMotion) return;
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated((amount ?? 0) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [amount, shouldReduceMotion]);

  const displayed = shouldReduceMotion ? (amount ?? 0) : animated;
  const hero = variant === "hero";
  // The full figure for screen readers — the visible one counts up.
  const prefix = amount !== null && amount < 0 ? "−" : sign;
  const spoken = amount === null ? label : `${label}: ${prefix}${formatCurrency(Math.abs(amount))}`;

  return (
    <div
      className={cn("motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:fill-mode-backwards", className)}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={onClick ? `${spoken}. Show details` : spoken}
        className={cn(
          "w-full h-full text-left rounded-xl border border-border bg-card flex flex-col transition-colors",
          "hover:bg-secondary/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          hero ? "p-5 gap-1.5 md:px-6" : "p-3 gap-1.5 sm:p-4 md:p-5"
        )}
      >
        <span className={cn("flex items-center w-full font-semibold text-foreground", hero ? "text-sm" : "text-sm sm:text-sm")}>
          {label}
          {onClick && <ChevronRight size={14} className="ml-auto text-muted-foreground shrink-0" aria-hidden />}
        </span>
        <span
          aria-hidden
          className={cn(
            "font-mono tabular-nums font-medium leading-tight",
            hero ? "text-3xl sm:text-4xl tracking-[-0.01em]" : "text-sm sm:text-xl md:text-2xl",
            negative ? "text-destructive" : "text-foreground"
          )}
        >
          {amount === null ? "—" : <>{prefix}{formatCurrency(Math.abs(displayed))}</>}
        </span>
        {hero && sentence && (
          <span className="text-base leading-relaxed text-foreground/80 max-w-[52ch]">{sentence}</span>
        )}
        {hero && note && <span className="text-xs text-muted-foreground">{note}</span>}
      </button>
    </div>
  );
}
