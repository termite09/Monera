"use client";

import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatShortDate, roundMoney, formatWeekdayDate, parseDateStr, MS_PER_DAY } from "@/lib/utils";
import { billKind, type UpcomingBill } from "@/lib/safeToSpend";
import type { PeriodTiming } from "@/types";

interface Props {
  /** Exactly the charges Safe to spend holds back before payday. */
  charges: UpcomingBill[];
  periodTiming: PeriodTiming;
  /** "YYYY-MM-DD" */
  today: string;
  /** e.g. "24 Oct" */
  paydayLabel: string;
}

function whenLabel(dateStr: string, today: string): string {
  const diffDays = Math.round((parseDateStr(dateStr).getTime() - parseDateStr(today).getTime()) / MS_PER_DAY);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return formatWeekdayDate(dateStr);
}

function kindLabel(c: UpcomingBill): string {
  return c.estimated && c.lastChargeDate ? `${billKind(c)} · last charged ${formatShortDate(c.lastChargeDate)}` : billKind(c);
}

export function UpcomingChargesCard({ charges, periodTiming, today, paydayLabel }: Props) {
  const router = useRouter();
  const hasEstimated = charges.some((c) => c.estimated);
  const total = roundMoney(charges.reduce((s, c) => s + c.amount, 0));

  return (
    <Card className="md:flex md:flex-col">
      <CardHeader className="pb-2 pt-4 px-4 md:px-6 md:shrink-0">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <CalendarClock size={16} aria-hidden />
          <h2>Upcoming bills</h2>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {periodTiming === "current"
            ? charges.length > 0
              ? <><span className="font-mono tabular-nums">{formatCurrency(total)}</span> due by payday, {paydayLabel}</>
              : <>Nothing due by payday, {paydayLabel}</>
            : periodTiming === "past"
              ? "This pay period has ended."
              : "This pay period hasn't started yet."}
        </p>
      </CardHeader>
      {charges.length > 0 && (
        <CardContent className="px-4 pb-4 md:px-6 md:flex-1 md:flex md:flex-col md:min-h-0">
          <ul className="flex flex-col divide-y divide-border md:flex-1 md:overflow-y-auto md:overflow-x-hidden md:min-h-0 md:pr-2">
            {charges.map((charge, i) => (
              <li key={`${charge.name}-${charge.date}-${i}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{charge.name}</p>
                  <p className="text-xs text-muted-foreground">{kindLabel(charge)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium tabular-nums font-mono text-foreground">
                    {charge.estimated && <span aria-label="about">~</span>}
                    {formatCurrency(charge.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">{whenLabel(charge.date, today)}</p>
                </div>
              </li>
            ))}
          </ul>
          {hasEstimated && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border max-w-[65ch] md:shrink-0">
              ~ = estimated.{" "}
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => router.push("/settings?tab=bills")}
              >
                Add it as a bill
              </button>{" "}
              for an exact date.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
