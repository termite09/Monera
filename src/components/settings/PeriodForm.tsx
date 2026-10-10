"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getPeriodLabel, getDisplayCurrency } from "@/lib/utils";
import { useSaveStatus } from "@/hooks/useSaveStatus";
import type { Settings } from "@/types";
import { SaveButton } from "./SaveButton";
import { BudgetSplitFields, fromSplitDraft, splitTotal, toSplitDraft } from "./BudgetSplitFields";

/** Pay and split for one pay period only. Mount with `key={periodKey}` so it resets per period. */
export function PeriodForm({ periodKey, settings, updateSettings }: {
  periodKey: string;
  settings: Settings;
  updateSettings: (s: Settings) => Promise<void>;
}) {
  const periodBudget = settings.monthlyBudgets[periodKey];
  const hasCustom = !!periodBudget;
  const savedIncome = String(periodBudget?.income ?? "");
  const savedSplit = toSplitDraft(periodBudget?.budgetRule ?? settings.defaultBudgetRule);

  const [income, setIncome] = useState(savedIncome);
  const [split, setSplit] = useState(savedSplit);
  const { status, run } = useSaveStatus();

  const total = splitTotal(split);
  const label = getPeriodLabel(periodKey, settings.paydayOfMonth);
  // Save only makes sense once something differs from what's already in effect.
  const dirty = income !== savedIncome || split.needs !== savedSplit.needs || split.wants !== savedSplit.wants || split.savings !== savedSplit.savings;

  const handleSave = () => {
    if (total !== 100) return;
    run(() =>
      updateSettings({
        ...settings,
        monthlyBudgets: {
          ...settings.monthlyBudgets,
          [periodKey]: { month: periodKey, income: parseFloat(income) || 0, budgetRule: fromSplitDraft(split) },
        },
      })
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">This pay period</h2>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-[65ch]">{label}</p>
        </div>
        {hasCustom ? (
          <Badge variant="outline" className="text-xs">Changed</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">Using Basics</Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-lg font-semibold text-foreground"><h3>Pay this period</h3></CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-1.5">
          <Label htmlFor="period-income">Amount ({getDisplayCurrency().trim()})</Label>
          <Input id="period-income" type="number" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 2200" className="h-11 max-w-48 font-mono tabular-nums" />
          <p className="text-xs text-muted-foreground max-w-[65ch]">
            What you expect to be paid this period. Once the payment shows up in your statement, the real amount is used instead.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground"><h3>Budget split</h3></CardTitle>
          {!hasCustom && (
            <button type="button" onClick={() => setSplit(toSplitDraft(settings.defaultBudgetRule))} className="tap-area text-xs text-primary hover:underline">
              Start from Basics
            </button>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <BudgetSplitFields idPrefix="period" value={split} onChange={setSplit} />
        </CardContent>
      </Card>

      <SaveButton status={status} onClick={handleSave} disabled={!dirty || total !== 100} label={`Save for ${label}`} />
    </div>
  );
}
