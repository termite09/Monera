"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { YearBar } from "@/components/charts/YearBar";
import { useAppData } from "@/contexts/AppDataContext";


import { formatCurrency } from "@/lib/utils";

export default function YearOverviewPage() {
  
  
  const { transactions, isLoading } = useAppData();
  const [year, setYear] = useState(new Date().getFullYear());

  const yearTxs = transactions.filter((t) => t.date.startsWith(String(year)));
  const totalExpenses = yearTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalSavings = yearTxs.filter((t) => t.category === "Savings").reduce((s, t) => s + t.amount, 0);

  return (
    <PageShell>
      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Year Overview</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)} className="size-9">
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium text-foreground w-12 text-center tabular-nums">{year}</span>
            <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)} className="size-9">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-none border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Expenses</p>
              <p className="text-xl font-medium text-foreground tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>
                {formatCurrency(totalExpenses)}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-none border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Savings</p>
              <p className="text-xl font-medium text-emerald-600 dark:text-emerald-400 tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>
                {formatCurrency(totalSavings)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-none border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Monthly Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <YearBar transactions={yearTxs} year={year} />
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
