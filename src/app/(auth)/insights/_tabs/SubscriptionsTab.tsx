"use client";

import { useMemo, useState } from "react";
import { ChevronDown, CalendarClock, CreditCard } from "lucide-react";
import { Transaction, RecurringPayment } from "@/types";
import {
  formatCurrency, formatDate, formatMonthShort, cleanDescription, cn, ordinal, getCategoryTextClass,
  getCategorySwatchClass, parseDateStr, plural, roundMoney,
} from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { merchantKey, monthlyCost, type Subscription } from "@/lib/insights";
import { billPeriodLabel, getRecurringInRange } from "@/lib/recurring";

interface Props {
  recurringPayments: RecurringPayment[];
  /** Already filtered — hidden subscriptions removed by the parent. */
  subscriptions: Subscription[];
  transactions: Transaction[];
  paydayOfMonth: number;
  /** "YYYY-MM-DD" */
  today: string;
  /** How many detected subscriptions are currently hidden. */
  hiddenCount: number;
  onHide: (name: string) => void;
  onRestore: () => void;
}

export function SubscriptionsTab({ recurringPayments, subscriptions, transactions, paydayOfMonth, today, hiddenCount, onHide, onRestore }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Bills only count from your first statement onwards — before that Monera knows nothing.
  const earliestDate = useMemo(
    () => transactions.reduce<string | null>((min, t) => (t.source !== "recurring" && (!min || t.date < min) ? t.date : min), null),
    [transactions]
  );
  const timesPaid = (p: RecurringPayment) =>
    earliestDate ? getRecurringInRange([p], parseDateStr(earliestDate), parseDateStr(today), paydayOfMonth).length : 0;

  const billsMonthly = roundMoney(recurringPayments.reduce((s, p) => s + p.amount, 0));
  const subsMonthly = roundMoney(subscriptions.reduce((s, sub) => s + monthlyCost(sub), 0));

  return (
    <>
      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CalendarClock size={13} aria-hidden /> <h2>Your regular bills</h2>
          </CardTitle>
          {recurringPayments.length > 1 && (
            <span className="text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{formatCurrency(billsMonthly)}</span> a month
            </span>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {recurringPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No recurring bills set up yet. Add them in Settings → Bills.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {recurringPayments.map((p) => {
                const badge = billPeriodLabel(p);
                const count = timesPaid(p);
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
                          <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md shrink-0">{badge}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-[65ch]">Due on the {ordinal(p.dayOfMonth)}</p>
                    </div>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-medium tabular-nums text-foreground font-mono">
                        {formatCurrency(p.amount)}<span className="font-sans font-normal text-muted-foreground"> a month</span>
                      </span>
                      {count > 0 && earliestDate && (
                        <span className="block text-xs text-muted-foreground">
                          paid {plural(count, "time")} since {formatMonthShort(earliestDate)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <CreditCard size={13} aria-hidden /> <h2>Subscriptions we found</h2>
            </CardTitle>
            {subscriptions.length > 0 && (
              <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
                <span className="font-medium text-foreground font-mono tabular-nums">~{formatCurrency(subsMonthly)}</span> a month
              </span>
            )}
          </div>
          {hiddenCount > 0 && (
            <p className="text-sm mt-1">
              <button type="button" onClick={onRestore} className="tap-area text-primary hover:underline">
                Show hidden ({hiddenCount})
              </button>
            </p>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No recurring subscriptions detected yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border -mx-4">
              {subscriptions.map((s) => {
                const isOpen = expandedKey === s.key;
                // The same charges detection grouped together, newest first.
                const charges = isOpen
                  ? transactions
                      .filter((t) => !t.excluded && t.type === "expense" && t.category === "Wants" && merchantKey(t.description) === s.key)
                      .sort((a, b) => b.date.localeCompare(a.date))
                  : [];
                return (
                  <div key={s.key} className="border-b border-border last:border-0">
                    <div className="flex items-center gap-1 pr-2">
                      <button
                        type="button"
                        onClick={() => setExpandedKey(isOpen ? null : s.key)}
                        aria-expanded={isOpen}
                        className="flex-1 min-w-0 flex items-center gap-2 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-foreground wrap-break-word">{s.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {s.everyMonths === 2 ? "Every 2 months" : "Monthly"} · seen in {s.months} months · last {formatDate(s.lastDate)}
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
                        onClick={() => onHide(s.name)}
                        className="min-h-11 px-3 flex items-center justify-center rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                        aria-label={`${s.name} isn't a subscription — hide it`}
                        title="Not a subscription? Hide it (won't change your numbers)"
                      >
                        Hide
                      </button>
                    </div>
                    {isOpen && (
                      <div className="mx-4 mb-3 rounded-lg bg-secondary/50">
                        <p className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
                          <span className="font-mono tabular-nums">{formatCurrency(s.total)}</span> across {plural(charges.length, "charge")} so far
                        </p>
                        <div className="divide-y divide-border">
                          {charges.map((tx) => (
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
