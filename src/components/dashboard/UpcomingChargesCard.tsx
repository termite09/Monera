"use client";

import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, cn, MS_PER_DAY } from "@/lib/utils";
import type { UpcomingCharge } from "@/lib/upcomingCharges";

interface Props {
  charges: UpcomingCharge[];
}

function relativeDate(dateStr: string): string {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((target.getTime() - todayMidnight.getTime()) / MS_PER_DAY);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return target.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const shortDate = (dateStr: string) =>
  new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function UpcomingChargesCard({ charges }: Props) {
  const router = useRouter();
  const hasEstimated = charges.some((c) => c.isEstimated);

  return (
    <Card className="md:h-full md:flex md:flex-col">
      <CardHeader className="pb-2 pt-4 px-4 md:px-6 md:shrink-0">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock size={15} aria-hidden />
          <h2>Upcoming charges</h2>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Next 14 days</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 md:px-6 md:flex-1 md:flex md:flex-col md:min-h-0">
        {charges.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nothing due in the next 14 days.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border md:flex-1 md:overflow-y-auto md:overflow-x-hidden md:min-h-0 md:pr-2">
            {charges.map((charge, i) => (
              <li
                key={`${charge.name}-${charge.date}-${i}`}
                className={cn("flex items-center gap-3 py-2.5 first:pt-0 last:pb-0")}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{charge.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {charge.isEstimated
                      ? `Estimated from ${shortDate(charge.lastChargeDate!)}`
                      : "Recurring bill"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium tabular-nums font-mono text-foreground">
                    {charge.isEstimated && <span aria-label="about">~</span>}
                    {formatCurrency(charge.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">{relativeDate(charge.date)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {hasEstimated && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border md:shrink-0">
            Estimated dates come from your last charge.{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => router.push("/settings?tab=bills")}
            >
              Add as a recurring payment
            </button>{" "}
            for exact dates.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
