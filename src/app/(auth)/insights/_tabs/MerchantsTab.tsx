"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatCurrency, formatDate, cleanDescription, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MerchantGroup } from "@/lib/insights";

interface Props {
  /** Any spending at all this period (before hiding merchants). */
  hasSpending: boolean;
  /** All spending this period, so hiding a place never changes the share figure. */
  periodSpending: number;
  /** Visible merchants, biggest first. */
  merchants: MerchantGroup[];
  hiddenCount: number;
  onHide: (name: string) => void;
  onResetHidden: () => void;
}

const TOP_N = 5;
const TXS_SHOWN = 20;

export function MerchantsTab({ hasSpending, periodSpending, merchants, hiddenCount, onHide, onResetHidden }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAllFor, setShowAllFor] = useState<Set<string>>(new Set());
  const [showAllMerchants, setShowAllMerchants] = useState(false);

  if (!hasSpending) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">No spending this period</p>
          <p className="text-muted-foreground text-xs mt-1">Add a statement or a transaction to see where your money went.</p>
        </CardContent>
      </Card>
    );
  }

  const maxTotal = Math.max(1, ...merchants.map((m) => m.total));
  const visible = showAllMerchants ? merchants : merchants.slice(0, TOP_N);
  const topShare = periodSpending > 0
    ? Math.round((merchants.slice(0, TOP_N).reduce((s, m) => s + m.total, 0) / periodSpending) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold text-foreground"><h2>Where your money went</h2></CardTitle>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={onResetHidden}
              className="tap-area ml-auto text-xs text-primary hover:underline rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Show hidden ({hiddenCount})
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-[65ch]">
          {merchants.length > TOP_N
            ? `Your top ${TOP_N} places took ${topShare}% of your spending this period.`
            : "Every place you spent money this period."}
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {merchants.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-2">No spending this period.</p>
        ) : (
          <ul>
            {visible.map((m) => {
              const isOpen = expanded === m.key;
              const shown = showAllFor.has(m.key) ? m.transactions : m.transactions.slice(0, TXS_SHOWN);
              return (
                <li key={m.key} className="border-b border-border last:border-0">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : m.key)}
                      aria-expanded={isOpen}
                      className="flex-1 flex flex-col gap-1.5 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                    >
                      <span className="flex items-center gap-2 w-full">
                        <span className="flex-1 min-w-0 text-sm text-foreground wrap-break-word">{m.name}</span>
                        {m.count > 1 && <span className="text-xs text-muted-foreground shrink-0">{m.count} times</span>}
                        <span className="text-sm font-medium tabular-nums font-mono text-foreground shrink-0">{formatCurrency(m.total)}</span>
                        <ChevronDown
                          size={14}
                          aria-hidden
                          className={cn("text-muted-foreground shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
                        />
                      </span>
                      <span className="block h-1.5 rounded-full bg-secondary overflow-hidden" aria-hidden>
                        <span
                          className="block h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 bg-chart-bar"
                          style={{ width: `${(m.total / maxTotal) * 100}%` }}
                        />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onHide(m.name)}
                      className="shrink-0 min-h-11 px-3 mr-1 flex items-center justify-center rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      aria-label={`Hide ${m.name} from this list`}
                      title="Hide from this list (won't change your numbers)"
                    >
                      Hide
                    </button>
                  </div>
                  {isOpen && (
                    <div className="mx-4 mb-3 rounded-lg bg-secondary/50">
                      <ul className="divide-y divide-border">
                        {shown.map((tx) => (
                          <li key={tx.id} className="flex items-center gap-2 px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                              <p className="text-sm text-foreground wrap-break-word">{cleanDescription(tx.description)}</p>
                            </div>
                            <span className="text-sm tabular-nums font-mono text-foreground shrink-0 w-20 text-right">
                              {formatCurrency(tx.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {shown.length < m.transactions.length && (
                        <button
                          type="button"
                          onClick={() => setShowAllFor((prev) => new Set([...prev, m.key]))}
                          className="w-full py-2.5 text-xs text-primary font-medium text-center border-t border-border hover:bg-secondary transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Show all {m.transactions.length} transactions
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {merchants.length > TOP_N && (
          <button
            type="button"
            onClick={() => setShowAllMerchants((v) => !v)}
            className="w-full py-3 text-sm text-primary font-medium hover:bg-secondary/50 transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showAllMerchants ? `Show top ${TOP_N} only` : `Show all ${merchants.length} places`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
