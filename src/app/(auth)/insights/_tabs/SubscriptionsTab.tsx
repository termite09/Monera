"use client";

import { useState } from "react";
import { Transaction, RecurringPayment } from "@/types";
import { formatCurrency, formatDate, cleanDescription, cn, getMonthKey, ordinal, getCategoryTextClass, getCategorySwatchClass } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, CalendarClock, CreditCard, EyeOff } from "lucide-react";
import type { detectSubscriptions } from "@/lib/reports";

type Subscription = ReturnType<typeof detectSubscriptions>[number];

function formatPeriodKey(key: string): string {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function getPeriodRangeBadge(startMonth?: string, endMonth?: string): string | null {
  if (!startMonth && !endMonth) return null;
  if (startMonth && endMonth) return `${formatPeriodKey(startMonth)} – ${formatPeriodKey(endMonth)}`;
  if (startMonth) return `From ${formatPeriodKey(startMonth)}`;
  return `Until ${formatPeriodKey(endMonth!)}`;
}


function countBillPeriods(p: RecurringPayment, currentMonth: string, fallbackStart: string): number {
  const start = p.startMonth ?? fallbackStart;
  const end = p.endMonth && p.endMonth < currentMonth ? p.endMonth : currentMonth;
  if (start > end) return 0;
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

interface Props {
  recurringPayments: RecurringPayment[];
  subscriptions: Subscription[];   // already filtered — excluded subs removed by parent
  transactions: Transaction[];
  paydayOfMonth: number;
  excludedSubCount: number;        // how many detected subs are currently hidden
  onExclude: (name: string) => void;
  onRestore: () => void;
}

export function SubscriptionsTab({ recurringPayments, subscriptions, transactions, paydayOfMonth, excludedSubCount, onExclude, onRestore }: Props) {
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  const subsMonthly = subscriptions.reduce((s, sub) => s + sub.amount, 0);

  const todayMonth = getMonthKey(new Date(), paydayOfMonth);
  const earliestDate = transactions.length > 0
    ? transactions.reduce((min, t) => t.date < min ? t.date : min, transactions[0].date)
    : null;
  const earliestMonth = earliestDate ? getMonthKey(earliestDate, paydayOfMonth) : todayMonth;

  return (
    <>
      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarClock size={13} aria-hidden /> <h2>Your regular bills</h2>
          </CardTitle>
          {recurringPayments.length > 0 && (
            <span className="text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{formatCurrency(recurringPayments.reduce((s, p) => s + p.amount, 0))}</span> per period
            </span>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {recurringPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No recurring bills set up yet. Add them in Settings → Bills.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">Bills you added in Settings, usually paid from another account.</p>
              <div className="flex flex-col divide-y divide-border">
                {recurringPayments.map((p) => {
                  const badge = getPeriodRangeBadge(p.startMonth, p.endMonth);
                  const count = countBillPeriods(p, todayMonth, earliestMonth);
                  const total = count * p.amount;
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-foreground wrap-break-word min-w-0">{p.name}</p>
                          <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-1.5 py-0.5 rounded-md shrink-0 bg-secondary", getCategoryTextClass(p.category))}>
                            <span className={cn("size-2 rounded-sm", getCategorySwatchClass(p.category))} aria-hidden />
                            {p.category}
                          </span>
                          {badge && (
                            <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md shrink-0">
                              {badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ordinal(p.dayOfMonth)} of the month · {formatCurrency(p.amount)} per period · {count} time{count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-foreground shrink-0 font-mono">{formatCurrency(total)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CreditCard size={13} aria-hidden /> <h2>Subscriptions we found</h2>
            </CardTitle>
            {subscriptions.length > 0 && <span className="text-sm text-muted-foreground"><span className="font-medium text-foreground font-mono tabular-nums">~{formatCurrency(subsMonthly)}</span> per period</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Optional things you pay for about once a month, like streaming, apps and the gym. Hide anything that isn&apos;t a subscription.
            {excludedSubCount > 0 && (
              <>
                {" "}
                <button type="button" onClick={onRestore} className="text-primary hover:underline">
                  Show hidden ({excludedSubCount})
                </button>
              </>
            )}
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No recurring subscriptions detected yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border -mx-4">
              {subscriptions.map((s) => {
                const isOpen = expandedSub === s.name;
                const subTxs = isOpen
                  ? transactions
                      .filter((t) => !t.excluded && t.type === "expense" && t.description.toLowerCase().includes(s.name.toLowerCase().trim()))
                      .sort((a, b) => b.date.localeCompare(a.date))
                  : [];
                return (
                  <div key={s.name} className="border-b border-border last:border-0">
                    <div className="flex items-center gap-1 pr-2">
                      <button
                        type="button"
                        onClick={() => setExpandedSub(isOpen ? null : s.name)}
                        aria-expanded={isOpen}
                        className="flex-1 min-w-0 flex items-center gap-2 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-foreground wrap-break-word">{s.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            Seen in {s.months} months · last {formatDate(s.lastDate)}
                          </span>
                        </span>
                        <span className="text-sm font-medium tabular-nums text-foreground shrink-0 font-mono">~{formatCurrency(s.amount)}</span>
                        <ChevronDown
                          size={14}
                          aria-hidden
                          className={cn("text-muted-foreground shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => onExclude(s.name)}
                        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                        aria-label={`${s.name} isn't a subscription — hide it`}
                        title="Not a subscription? Hide it (won't change your numbers)"
                      >
                        <EyeOff size={14} aria-hidden />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="mx-4 mb-3 rounded-lg bg-secondary/50">
                        <p className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
                          <span className="font-mono tabular-nums">{formatCurrency(s.total)}</span> across {subTxs.length} charge{subTxs.length === 1 ? "" : "s"} so far
                        </p>
                        <div className="divide-y divide-border">
                          {subTxs.length === 0 ? (
                            <p className="text-sm text-muted-foreground px-3 py-3">No transactions found.</p>
                          ) : subTxs.map((tx) => (
                            <div key={tx.id} className="flex items-start gap-3 px-3 py-2.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground wrap-break-word">{cleanDescription(tx.description)}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                              </div>
                              <span className="text-sm tabular-nums font-mono text-foreground shrink-0 w-20 text-right">{formatCurrency(tx.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
