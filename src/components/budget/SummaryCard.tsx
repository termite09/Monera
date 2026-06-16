"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

interface SummaryCardProps {
  label: string;
  amount: number;
  icon: string;
  colorClass: string;
  index: number;
}

export function SummaryCard({ label, amount, icon, colorClass, index }: SummaryCardProps) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 600;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(amount * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [amount]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
    >
      <Card>
        <div className="flex items-start justify-between mb-2">
          <span className="text-gray-500 dark:text-gray-400 text-sm">{label}</span>
          <span className="text-xl">{icon}</span>
        </div>
        <p className={`text-2xl font-semibold tabular-nums ${colorClass}`}>
          {formatCurrency(displayed)}
        </p>
      </Card>
    </motion.div>
  );
}
