"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Transaction } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthlyCategoryTotals } from "@/lib/reports";
import { getRecurringInRange } from "@/lib/recurring";
import type { RecurringPayment } from "@/types";

const YearBar = dynamic(
  () => import("@/components/charts/YearBar").then((m) => m.YearBar),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

interface Props {
  transactions: Transaction[];
  recurringPayments: RecurringPayment[];
  currency: string;
  paydayOfMonth: number;
  onMonthClick: (key: string) => void;
}

export function YearTab({ transactions, recurringPayments, currency, paydayOfMonth, onMonthClick }: Props) {
  const [year, setYear] = useState(() => new Date().getFullYear());

  const yearAllTxs = useMemo(() => [
    ...transactions,
    ...getRecurringInRange(recurringPayments, new Date(year, 0, 1), new Date(year, 11, 31), paydayOfMonth, currency),
  ], [transactions, recurringPayments, currency, year, paydayOfMonth]);

  const yearTotals = useMemo(() => monthlyCategoryTotals(yearAllTxs, year, paydayOfMonth), [yearAllTxs, year, paydayOfMonth]);

  const yearExpenses = yearTotals.reduce((s, m) => s + m.needs + m.wants + m.savings, 0);
  const yearSavings = yearTotals.reduce((s, m) => s + m.savings, 0);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Spending across the year, by payday period.</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)} className="size-9" aria-label="Previous year">
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-medium text-foreground w-12 text-center tabular-nums">{year}</span>
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)} className="size-9" aria-label="Next year">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-none border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Expenses</p>
            <p className="text-xl font-medium text-foreground tabular-nums font-mono">{formatCurrency(yearExpenses)}</p>
            <p className="text-xs text-muted-foreground mt-1">All spending across every period this year.</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Savings</p>
            <p className="text-xl font-medium text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">{formatCurrency(yearSavings)}</p>
            <p className="text-xs text-muted-foreground mt-1">Everything in the Savings category across the year.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none border-border">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Breakdown</CardTitle>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">Each bar shows Needs, Wants, and Savings for that period. Tap a bar to go to that period on the dashboard.</p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <YearBar
            transactions={yearAllTxs}
            year={year}
            paydayOfMonth={paydayOfMonth}
            onMonthClick={onMonthClick}
          />
        </CardContent>
      </Card>
    </>
  );
}
