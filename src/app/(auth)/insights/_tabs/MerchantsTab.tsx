"use client";

import { useState } from "react";
import { Transaction } from "@/types";
import { formatCurrency, formatDate, cleanDescription, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, EyeOff, Trophy, Repeat, Receipt } from "lucide-react";
import type { buildReport } from "@/lib/reports";

type Report = ReturnType<typeof buildReport>;

interface Merchant {
  name: string;
  total: number;
  count: number;
}

interface Props {
  report: Report;
  allMerchants: Merchant[];
  periodExpenseTxs: Transaction[];
  hiddenMerchants: string[];
  onHide: (name: string) => void;
  onResetHidden: () => void;
}

export function MerchantsTab({ report, allMerchants, periodExpenseTxs, hiddenMerchants, onHide, onResetHidden }: Props) {
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);
  const [showAllFor, setShowAllFor] = useState<Set<string>>(new Set());

  const maxMerchantTotal = Math.max(1, ...allMerchants.map((m) => m.total));

  if (report.txCount === 0) {
    return (
      <Card className="rounded-2xl border-border/70">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">No spending this period</p>
          <p className="text-muted-foreground/50 text-xs mt-1">Upload a statement or add transactions to see reports</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Trophy size={13} /> Where Your Money Goes
            {hiddenMerchants.length > 0 && (
              <button
                onClick={onResetHidden}
                className="ml-auto text-[10px] normal-case font-normal text-primary hover:underline tracking-normal"
              >
                Show all ({hiddenMerchants.length} hidden)
              </button>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Every place you spent money this period, ranked by total amount. Tap any merchant to see the transactions behind it.</p>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {allMerchants.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-2">No expense transactions this period.</p>
          ) : (
            <div className="overflow-y-auto max-h-[60vh]">
              {allMerchants.map((m) => {
                const isOpen = expandedMerchant === m.name;
                const txs = periodExpenseTxs.filter((tx) => tx.description === m.name);
                const showAll = showAllFor.has(m.name);
                const displayTxs = showAll ? txs : txs.slice(0, 20);
                return (
                  <div key={m.name} className="border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedMerchant(isOpen ? null : m.name)}
                        className="flex-1 flex flex-col gap-1.5 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex-1 min-w-0 text-sm text-foreground break-words">{m.name}</span>
                          {m.count > 1 && (
                            <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md shrink-0">
                              {m.count}×
                            </span>
                          )}
                          <span className="text-sm font-medium tabular-nums font-mono text-foreground shrink-0">
                            {formatCurrency(m.total)}
                          </span>
                          <ChevronDown
                            size={14}
                            className={cn("text-muted-foreground/50 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
                          />
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${(m.total / maxMerchantTotal) * 100}%` }}
                          />
                        </div>
                      </button>
                      <button
                        onClick={() => onHide(m.name)}
                        className="shrink-0 p-2 mr-2 rounded-md text-muted-foreground/30 hover:text-muted-foreground hover:bg-secondary transition-colors"
                        aria-label={`Hide ${m.name} from this view`}
                        title="Hide from this view (won't affect your data)"
                      >
                        <EyeOff size={14} />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden">
                        <div className="divide-y divide-border">
                          {displayTxs.map((tx) => (
                            <div key={tx.id} className="flex items-center gap-2 px-3 py-2.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                                <p className="text-sm text-foreground break-words">{cleanDescription(tx.description)}</p>
                              </div>
                              <span className="text-sm tabular-nums font-mono text-foreground shrink-0 w-20 text-right">
                                {formatCurrency(tx.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                        {txs.length > 20 && !showAll && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowAllFor((prev) => new Set([...prev, m.name])); }}
                            className="w-full py-2.5 text-xs text-primary font-medium text-center border-t border-border hover:bg-secondary/50 transition-colors"
                          >
                            Show all {txs.length} transactions
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Repeat size={13} /> Most Recurring
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Merchants you&apos;ve paid more than once this period, ranked by number of visits — useful for spotting habits.</p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {report.frequentMerchants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No repeat merchants yet this period.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {report.frequentMerchants.map((m) => (
                <div key={m.name} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center justify-center size-9 rounded-full bg-secondary text-xs font-semibold tabular-nums text-foreground shrink-0">{m.count}×</span>
                    <span className="text-sm text-foreground break-words min-w-0">{m.name}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-foreground shrink-0 pl-2 font-mono">{formatCurrency(m.total)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Receipt size={13} /> Biggest Purchases
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Your largest individual transactions this period.</p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-col divide-y divide-border">
            {report.biggest.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 pr-2">
                  <p className="text-sm text-foreground break-words">{cleanDescription(t.description)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)} · {t.category}</p>
                </div>
                <span className="text-sm font-medium tabular-nums text-foreground shrink-0 font-mono">{formatCurrency(t.amount)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
