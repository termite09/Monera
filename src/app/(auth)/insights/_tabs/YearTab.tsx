"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Transaction } from "@/types";
import { getCurrentPeriodKey, toMonthKey } from "@/lib/periods";
import { formatCurrency, getPeriodLabel, ordinal } from "@/lib/format";
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
  /** Bills still to come in the running pay period (spending only). */
  dueThisPeriod: number;
  onPeriodClick: (periodKey: string) => void;
}

export function YearTab({ transactions, paydayOfMonth, year, dueThisPeriod, onPeriodClick }: Props) {
  const totals = useMemo(() => periodTotalsForYear(transactions, year, paydayOfMonth), [transactions, year, paydayOfMonth]);

  // "Spent" never includes savings — the same meaning as on the dashboard.
  const yearSpent = roundMoney(totals.reduce((s, m) => s + m.needs + m.wants, 0));
  const yearSaved = roundMoney(totals.reduce((s, m) => s + m.savings, 0));

  const currentKey = getCurrentPeriodKey(paydayOfMonth);

  // The chart's one-line takeaway: the biggest finished period, and how the
  // running one stands, so its short bar isn't read as a cheap month.
  const spentIn = (i: number) => roundMoney(totals[i].needs + totals[i].wants);
  const keys = totals.map((_, i) => toMonthKey(year, i));
  const finished = keys.map((key, i) => ({ key, spent: spentIn(i) })).filter((p) => p.key < currentKey && p.spent > 0);
  const peak = finished.reduce<{ key: string; spent: number } | null>((best, p) => (!best || p.spent > best.spent ? p : best), null);
  const runningIdx = keys.indexOf(currentKey);
  const takeaway = (
    <>
      {peak && <>{getPeriodLabel(peak.key, paydayOfMonth)} was your biggest pay period: <Money amount={peak.spent} />. </>}
      {runningIdx >= 0 && (spentIn(runningIdx) > 0 || dueThisPeriod > 0) && (
        <>
          This pay period so far: <Money amount={spentIn(runningIdx)} />
          {dueThisPeriod > 0 && <>, with <Money amount={dueThisPeriod} /> in bills still to come</>}.
        </>
      )}
      {!peak && runningIdx < 0 && <>Nothing spent in {year}.</>}
    </>
  );

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
          <CardTitle className="text-lg font-semibold text-foreground"><h2>By pay period</h2></CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-[65ch]">{takeaway}</p>
          {paydayOfMonth > 1 && <p className="text-xs text-muted-foreground mt-0.5">Each period starts on the {ordinal(paydayOfMonth)}</p>}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <YearBar totals={totals} year={year} paydayOfMonth={paydayOfMonth} onPeriodClick={onPeriodClick} currentKey={currentKey} />
        </CardContent>
      </Card>
    </>
  );
}

function Money({ amount }: { amount: number }) {
  return <span className="font-medium text-foreground font-mono tabular-nums">{formatCurrency(amount)}</span>;
}
