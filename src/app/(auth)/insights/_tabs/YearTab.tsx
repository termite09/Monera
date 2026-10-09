"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Transaction } from "@/types";
import { formatCurrency, ordinal, getMonthKey } from "@/lib/utils";
import { getPeriodSpend } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthlyCategoryTotals } from "@/lib/reports";
import { getRecurringInRange } from "@/lib/recurring";
import { toDateStr } from "@/lib/utils";
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

  const yearAllTxs = useMemo(() => {
    const todayStr = toDateStr(new Date());
    // Bills only count from your first statement onwards — before that Monera
    // knows nothing about your money, so it shouldn't invent spending.
    const firstDate = transactions.reduce<string | null>((min, t) => (t.source !== "recurring" && (!min || t.date < min) ? t.date : min), null);
    const yearStart = new Date(year, 0, 1);
    const from = firstDate && new Date(firstDate + "T00:00:00") > yearStart ? new Date(firstDate + "T00:00:00") : yearStart;
    const bills = firstDate ? getRecurringInRange(recurringPayments, from, new Date(year, 11, 31), paydayOfMonth, currency) : [];
    return [...transactions, ...bills].filter((tx) => tx.date <= todayStr);
  }, [transactions, recurringPayments, currency, year, paydayOfMonth]);

  const yearTotals = useMemo(() => monthlyCategoryTotals(yearAllTxs, year, paydayOfMonth), [yearAllTxs, year, paydayOfMonth]);

  // "Spent" never includes savings — the same meaning as on the dashboard.
  const yearExpenses = useMemo(() => {
    let total = 0;
    for (let m = 1; m <= 12; m++) {
      const { total: periodTotal, byCategory } = getPeriodSpend(yearAllTxs, `${year}-${String(m).padStart(2, "0")}`, paydayOfMonth);
      total += periodTotal - byCategory.Savings;
    }
    return total;
  }, [yearAllTxs, year, paydayOfMonth]);
  const yearSavings = yearTotals.reduce((s, m) => s + m.savings, 0);

  return (
    <>
      <div className="flex items-center justify-between">
        <span />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)} className="size-11 sm:size-9" aria-label="Previous year">
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-medium text-foreground w-12 text-center tabular-nums">{year}</span>
          <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)} className="size-11 sm:size-9" aria-label="Next year">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Spent this year</p>
            <p className="text-2xl font-medium text-foreground tabular-nums font-mono">{formatCurrency(yearExpenses)}</p>
            <p className="text-xs text-muted-foreground mt-1">Savings not included</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Saved this year</p>
            <p className="text-2xl font-medium text-foreground tabular-nums font-mono">{formatCurrency(yearSavings)}</p>
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
            transactions={yearAllTxs}
            year={year}
            paydayOfMonth={paydayOfMonth}
            onMonthClick={onMonthClick}
            currentKey={getMonthKey(new Date(), paydayOfMonth)}
          />
        </CardContent>
      </Card>
    </>
  );
}
