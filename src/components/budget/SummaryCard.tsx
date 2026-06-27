"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoIcon } from "@/components/ui/InfoIcon";
import { cn, formatCurrency } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  amount: number;
  colorClass: string;
  index: number;
  secondaryText?: string;
  accent?: string;
  info?: string;
  onClick?: () => void;
}

export function SummaryCard({ label, amount, colorClass, index, secondaryText, accent = "#94a3b8", info, onClick }: SummaryCardProps) {
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
      setAnimated(amount * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [amount, shouldReduceMotion]);

  const displayed = shouldReduceMotion ? amount : animated;

  const cardContent = (
    <Card className={cn(
      "rounded-2xl border-border/70",
      onClick && "cursor-pointer active:scale-[0.98] transition-transform"
    )}>
      <CardContent className="p-4 h-27 flex flex-col">
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="size-1.5 rounded-full shrink-0" style={{ background: accent }} />
          <p className="text-xs font-semibold text-foreground flex-1">
            {label}
          </p>
          {info && <InfoIcon content={info} side="bottom" />}
          {onClick && <ChevronRight size={13} className="text-muted-foreground/50 shrink-0" />}
        </div>
        <p className={cn("text-xl sm:text-2xl leading-none font-medium tabular-nums font-mono", colorClass)}>
          {formatCurrency(displayed)}
        </p>
        {secondaryText && (
          <span className="mt-auto">
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
              {secondaryText}
            </span>
          </span>
        )}
      </CardContent>
    </Card>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: shouldReduceMotion ? 0 : index * 0.06, duration: shouldReduceMotion ? 0 : 0.3, ease: "easeOut" }}
      onClick={onClick}
    >
      {cardContent}
    </motion.div>
  );
}
