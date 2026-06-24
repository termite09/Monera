"use client";

import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, cn, MS_PER_DAY } from "@/lib/utils";
import type { UpcomingCharge } from "@/lib/upcomingCharges";

interface Props {
  charges: UpcomingCharge[];
  currency: string;
}

function relativeDate(dateStr: string): string {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((target.getTime() - todayMidnight.getTime()) / MS_PER_DAY);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return `in ${diffDays} days`;
  return formatDate(dateStr);
}

export function UpcomingChargesCard({ charges, currency }: Props) {
  const router = useRouter();

  if (charges.length === 0) return null;

  const hasEstimated = charges.some((c) => c.isEstimated);

  return (
    <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock size={15} /> Upcoming charges
        </CardTitle>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">Next 14 days</p>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-col divide-y divide-border">
          {charges.map((charge, i) => (
            <div
              key={`${charge.name}-${charge.date}-${i}`}
              className={cn(
                "flex items-center gap-3 py-2.5 first:pt-0 last:pb-0",
                charge.isEstimated &&
                  "-mx-4 px-4 rounded transition-colors"
              )}              
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{charge.name}</p>
                <p className="text-xs text-muted-foreground">
                  {charge.isEstimated
                    ? `estimated · last charged ${formatDate(charge.lastChargeDate!)}`
                    : "recurring bill"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium tabular-nums font-mono text-foreground">
                  {charge.isEstimated ? "~" : ""}
                  {formatCurrency(charge.amount, currency)}
                </p>
                <p className="text-xs text-muted-foreground">{relativeDate(charge.date)}</p>
              </div>
            </div>
          ))}
        </div>
        {hasEstimated && (
          <p className="text-[11px] text-muted-foreground/70 mt-3 pt-3 border-t border-border">
            ~ estimated from last charge date ·{" "}
            <button
              className="underline hover:text-foreground transition-colors"
              onClick={() => router.push("/settings?tab=bills")}
            >
              Add as recurring payment
            </button>{" "}
            for exact dates
          </p>
        )}
      </CardContent>
    </Card>
  );
}
