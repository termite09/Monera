"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  amount: number;
  icon: string;
  colorClass: string;
  index: number;
  secondaryText?: string;
  accent?: string;
}

export function SummaryCard({ label, amount, colorClass, index, secondaryText, accent = "#94a3b8" }: SummaryCardProps) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 700;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(amount * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [amount]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3, ease: "easeOut" }}
    >
      <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
        <CardContent className="p-4 h-[108px] flex flex-col">
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="size-1.5 rounded-full shrink-0" style={{ background: accent }} />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
              {label}
            </p>
          </div>
          <p className={cn("text-2xl leading-none font-medium tabular-nums", colorClass)} style={{ fontFamily: "'DM Mono', monospace" }}>
            {formatCurrency(displayed)}
          </p>
          {secondaryText && (
            <span className="mt-auto">
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                {secondaryText}
              </span>
            </span>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
