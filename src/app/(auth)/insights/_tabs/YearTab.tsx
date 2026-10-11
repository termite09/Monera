"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Transaction } from "@/types";
import { getCurrentPeriodKey } from "@/lib/periods";
import { formatCurrency, ordinal } from "@/lib/format";
import { roundMoney } from "@/lib/utils";
import { periodTotalsForYear } from "@/lib/insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const YearBar = dynamic(
  () => import("../_components/YearBar").then((m) => m.YearBar),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

interface Props {
  /** What has happened so far, bills included. */
  transactions: Transaction[];
  paydayOfMonth: number;
  /** Chosen in the page header. */
  year: number;
  onPeriodClick: (periodKey: string) => void;
}

export function YearTab({ transactions, paydayOfMonth, year, onPeriodClick }: Props) {
  const totals = useMemo(() => periodTotalsForYear(transactions, year, paydayOfMonth), [transactions, year, paydayOfMonth]);

  // "Spent" never includes savings — the same meaning as on the dashboard.
  const yearSpent = roundMoney(totals.reduce((s, m) => s + m.needs + m.wants, 0));
  const yearSaved = roundMoney(totals.reduce((s, m) => s + m.savings, 0));

  const currentKey = getCurrentPeriodKey(paydayOfMonth);

  return (
    <>
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
          {paydayOfMonth > 1 && <p className="text-xs text-muted-foreground mt-0.5">Each period starts on the {ordinal(paydayOfMonth)}</p>}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <YearBar totals={totals} year={year} paydayOfMonth={paydayOfMonth} onPeriodClick={onPeriodClick} currentKey={currentKey} />
        </CardContent>
      </Card>
    </>
  );
}
