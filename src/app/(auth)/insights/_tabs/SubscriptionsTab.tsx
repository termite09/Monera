"use client";

import { useState } from "react";
import { Transaction, Category, RecurringPayment } from "@/types";
import { formatCurrency, formatDate, cleanDescription, cn, getMonthKey, ordinal } from "@/lib/utils";
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

const CAT_CHIP: Record<Category, string> = {
  Needs: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
  Wants: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300",
  Savings: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300",
  Uncategorized: "bg-secondary text-muted-foreground",
};

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
      <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <CalendarClock size={13} /> Your Recurring Bills
          </CardTitle>
          {recurringPayments.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(recurringPayments.reduce((s, p) => s + p.amount, 0))}/mo
            </span>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {recurringPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No recurring bills set up yet. Add them in Settings → Bills.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">Added in Settings — paid outside Revolut, so they won&apos;t show up in your imported transactions.</p>
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
                          <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded-md shrink-0", CAT_CHIP[p.category])}>
                            {p.category}
                          </span>
                          {badge && (
                            <span className="text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md shrink-0">
                              {badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ordinal(p.dayOfMonth)} of the month · {formatCurrency(p.amount)}/mo · {count} time{count === 1 ? "" : "s"}
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

      <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <CreditCard size={13} /> Detected Subscriptions
              {excludedSubCount > 0 && (
                <button
                  onClick={onRestore}
                  className="ml-auto text-[10px] normal-case font-normal text-primary hover:underline tracking-normal"
                >
                  Show all ({excludedSubCount} hidden)
                </button>
              )}
            </CardTitle>
            {subscriptions.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">~{formatCurrency(subsMonthly)}/mo</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Repeat payments to the same place with a similar amount, appearing at least twice roughly a month apart.</p>
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
                  <div key={s.name} className="border-b border-border/50 last:border-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedSub(isOpen ? null : s.name)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedSub(isOpen ? null : s.name); }}
                      className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/50 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground wrap-break-word">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.months} month{s.months === 1 ? "" : "s"} · ~{formatCurrency(s.amount)}/charge · last {formatDate(s.lastDate)}
                        </p>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-foreground shrink-0 font-mono">{formatCurrency(s.total)}</span>
                      <ChevronDown
                        size={14}
                        className={cn("text-muted-foreground/50 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); onExclude(s.name); }}
                        className="p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
                        aria-label={`Hide ${s.name} from this view`}
                        title="Hide from this view (won't affect your data)"
                      >
                        <EyeOff size={14} />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden">
                        <p className="px-3 py-2 text-[11px] text-muted-foreground bg-secondary/50 border-b border-border">
                          {subTxs.length} charge{subTxs.length === 1 ? "" : "s"} across all history
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
