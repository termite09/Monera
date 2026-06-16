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
}

export function SummaryCard({ label, amount, colorClass, index, secondaryText }: SummaryCardProps) {
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
      <Card className="shadow-none border-border">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            {label}
          </p>
          <p className={cn("text-2xl font-medium tabular-nums", colorClass)} style={{ fontFamily: "'DM Mono', monospace" }}>
            {formatCurrency(displayed)}
          </p>
          {secondaryText && (
            <p className="text-xs text-muted-foreground mt-1.5 tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>
              {secondaryText}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
