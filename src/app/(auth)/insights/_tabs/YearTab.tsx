"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Transaction, RecurringPayment } from "@/types";
import { formatCurrency, ordinal, getCurrentPeriodKey, parseDateStr, roundMoney } from "@/lib/utils";
import { periodTotalsForYear } from "@/lib/insights";
import { getRecurringInRange } from "@/lib/recurring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const YearBar = dynamic(
  () => import("@/components/charts/YearBar").then((m) => m.YearBar),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

interface Props {
  transactions: Transaction[];
  recurringPayments: RecurringPayment[];
  currency: string;
  paydayOfMonth: number;
  /** "YYYY-MM-DD" */
  today: string;
  onPeriodClick: (periodKey: string) => void;
}

export function YearTab({ transactions, recurringPayments, currency, paydayOfMonth, today, onPeriodClick }: Props) {
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));

  const totals = useMemo(() => {
    // Bills only count from your first statement onwards — before that Monera
    // knows nothing about your money, so it shouldn't invent spending.
    const firstDate = transactions.reduce<string | null>((min, t) => (t.source !== "recurring" && (!min || t.date < min) ? t.date : min), null);
    const yearStart = new Date(year, 0, 1);
    const from = firstDate && parseDateStr(firstDate) > yearStart ? parseDateStr(firstDate) : yearStart;
    const bills = firstDate ? getRecurringInRange(recurringPayments, from, new Date(year, 11, 31), paydayOfMonth, currency) : [];
    const happened = [...transactions, ...bills].filter((tx) => tx.date <= today);
    return periodTotalsForYear(happened, year, paydayOfMonth);
  }, [transactions, recurringPayments, currency, year, paydayOfMonth, today]);

  // "Spent" never includes savings — the same meaning as on the dashboard.
  const yearSpent = roundMoney(totals.reduce((s, m) => s + m.needs + m.wants, 0));
  const yearSaved = roundMoney(totals.reduce((s, m) => s + m.savings, 0));

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)} className="size-11 sm:size-9" aria-label="Previous year">
          <ChevronLeft size={16} aria-hidden />
        </Button>
        <span className="text-sm font-medium text-foreground w-12 text-center tabular-nums">{year}</span>
        <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)} className="size-11 sm:size-9" aria-label="Next year">
          <ChevronRight size={16} aria-hidden />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Spent this year</p>
            <p className="text-2xl font-medium text-foreground tabular-nums font-mono">{formatCurrency(yearSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Saved this year</p>
            <p className="text-2xl font-medium text-foreground tabular-nums font-mono">{formatCurrency(yearSaved)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-lg font-semibold text-foreground">By pay period</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{paydayOfMonth > 1 ? `Each bar starts on the ${ordinal(paydayOfMonth)} · ` : ""}Savings not included</p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <YearBar
            totals={totals}
            year={year}
            paydayOfMonth={paydayOfMonth}
            onPeriodClick={onPeriodClick}
            currentKey={getCurrentPeriodKey(paydayOfMonth)}
          />
        </CardContent>
      </Card>
    </>
  );
}
