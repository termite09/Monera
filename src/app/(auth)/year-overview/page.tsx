"use client";

import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppData } from "@/contexts/AppDataContext";
import { formatCurrency } from "@/lib/utils";
import { monthlyCategoryTotals } from "@/lib/reports";
import { getRecurringInRange } from "@/lib/recurring";

const YearBar = dynamic(
  () => import("@/components/charts/YearBar").then((m) => m.YearBar),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

export default function YearOverviewPage() {
  const router = useRouter();
  const { transactions, settings, isLoading, setMonth } = useAppData();
  const [year, setYear] = useState(new Date().getFullYear());
  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  const handleMonthClick = useCallback((monthKey: string) => {
    setMonth(monthKey);
    router.push("/dashboard");
  }, [setMonth, router]);

  // Include recurring bills (paid outside Revolut) so yearly figures match the
  // dashboard/reports, which inject them per period.
  const allTxs = useMemo(
    () => [
      ...transactions,
      ...getRecurringInRange(
        settings.recurringPayments ?? [],
        new Date(year, 0, 1),
        new Date(year, 11, 31),
        paydayOfMonth,
        settings.currency ?? "EUR"
      ),
    ],
    [transactions, settings.recurringPayments, settings.currency, year, paydayOfMonth]
  );

  // Derive the cards from the same payday-aware monthly totals the chart uses, so
  // the headline figures always match the bars below (and honor the pay cycle).
  const totals = monthlyCategoryTotals(allTxs, year, paydayOfMonth);
  const totalExpenses = totals.reduce((s, m) => s + m.needs + m.wants + m.savings, 0);
  const totalSavings = totals.reduce((s, m) => s + m.savings, 0);

  return (
    <PageShell>
      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Year Overview</h1>
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
              <p className="text-xl font-medium text-foreground tabular-nums font-mono">
                {formatCurrency(totalExpenses)}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-none border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Savings</p>
              <p className="text-xl font-medium text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
                {formatCurrency(totalSavings)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-none border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Monthly Breakdown
            </CardTitle>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">Tap a month to view its transactions on the dashboard.</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <YearBar transactions={allTxs} year={year} paydayOfMonth={paydayOfMonth} onMonthClick={handleMonthClick} />
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
