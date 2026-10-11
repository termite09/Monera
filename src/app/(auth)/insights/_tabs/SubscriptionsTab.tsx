"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, CalendarClock, CreditCard } from "lucide-react";
import { Transaction, RecurringPayment } from "@/types";
import { formatCurrency, formatDate, formatShortDate, formatMonthShort, formatMonthYear, cleanDescription, ordinal } from "@/lib/format";
import { getCategoryTextClass, getCategorySwatchClass } from "@/lib/categories";
import { cn, roundMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { merchantKey, monthlyCost, type Subscription } from "@/lib/insights";
import { billPeriodLabel } from "@/lib/recurring";
import { HiddenItems } from "../_components/HiddenItems";

/** A hidden subscription leaves the monthly total on this card, but not your spending. */
const HIDDEN_NOTE = "Not counted in the subscriptions' monthly total. Your spending figures don't change.";

interface Props {
  recurringPayments: RecurringPayment[];
  /** Every bill charged so far, from the app data. */
  billsPaid: Transaction[];
  /** Already filtered — hidden subscriptions removed by the parent. */
  subscriptions: Subscription[];
  transactions: Transaction[];
  /** "YYYY-MM-DD" */
  today: string;
  /** How many detected subscriptions are currently hidden. */
  /** Detected subscriptions the user has hidden. */
  hiddenNames: string[];
  onHide: (name: string) => void;
  onShow: (name: string) => void;
  onShowAll: () => void;
}

export function SubscriptionsTab({ recurringPayments, billsPaid, subscriptions, transactions, today, hiddenNames, onHide, onShow, onShowAll }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // Hiding removes the row that had focus; the heading takes it instead of the page.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hide = (name: string) => {
    onHide(name);
    headingRef.current?.focus();
  };

  // Each bill's total so far (periods it was left out of don't count), since its
  // first charge, which is later for a bill that started later.
  const paid = useMemo(() => {
    const byBill = new Map<string, { total: number; from: string }>();
    for (const t of billsPaid) {
      if (t.excluded || !t.billId) continue;
      const b = byBill.get(t.billId);
      byBill.set(t.billId, { total: roundMoney((b?.total ?? 0) + t.amount), from: b && b.from < t.date ? b.from : t.date });
    }
    return byBill;
  }, [billsPaid]);
  // The year only when it isn't this year: "Mar" / "Mar 2025", "5 Jun" / "5 Jun 2025".
  const thisYear = (date: string) => date.slice(0, 4) === today.slice(0, 4);
  const since = (date: string) => (thisYear(date) ? formatMonthShort(date) : formatMonthYear(date.slice(0, 7)));

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
                const paidSoFar = paid.get(p.id);
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
                      {paidSoFar && paidSoFar.total > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">{formatCurrency(paidSoFar.total)}</span> paid since {since(paidSoFar.from)}
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
              <CreditCard size={13} aria-hidden /> <h2 ref={headingRef} tabIndex={-1} className="focus-visible:outline-none">Subscriptions we found</h2>
            </CardTitle>
            {subscriptions.length > 0 && (
              <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
                <span className="font-medium text-foreground font-mono tabular-nums">~{formatCurrency(subsMonthly)}</span> a month
              </span>
            )}
          </div>
          <HiddenItems
            names={hiddenNames}
            note={HIDDEN_NOTE}
            onShow={onShow}
            onShowAll={onShowAll}
            onAfterShow={() => headingRef.current?.focus()}
            className="mt-1"
          />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {hiddenNames.length > 0 ? "No other subscriptions found." : "No recurring subscriptions detected yet."}
            </p>
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
                          <span className="block text-xs text-muted-foreground">Last charged {thisYear(s.lastDate) ? formatShortDate(s.lastDate) : formatDate(s.lastDate)}</span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-sm font-medium tabular-nums text-foreground font-mono">
                            {formatCurrency(s.amount)}<span className="font-sans font-normal text-muted-foreground">{s.everyMonths === 2 ? " every 2 months" : " a month"}</span>
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            <span className="font-mono tabular-nums">{formatCurrency(s.total)}</span> paid since {since(s.firstDate)}
                          </span>
                        </span>
                        <ChevronDown
                          size={14}
                          aria-hidden
                          className={cn("text-muted-foreground shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => hide(s.name)}
                        className="min-h-11 px-3 flex items-center justify-center rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                        aria-label={`${s.name} isn't a subscription — hide it. Your spending figures don't change.`}
                      >
                        Hide
                      </button>
                    </div>
                    {isOpen && (
                      <div className="mx-4 mb-3 rounded-lg bg-secondary/50">
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
