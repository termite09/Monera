"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAppData } from "@/contexts/AppDataContext";
import { getMonthLabel, cn, getDisplayCurrency } from "@/lib/utils";

export function MonthForm({ month, settings, paydayOfMonth, updateSettings }: {
  month: string;
  settings: ReturnType<typeof useAppData>["settings"];
  paydayOfMonth: number;
  updateSettings: ReturnType<typeof useAppData>["updateSettings"];
}) {
  const hasCustom = !!settings.monthlyBudgets[month];
  const monthBudget = settings.monthlyBudgets[month];
  const rule = monthBudget?.budgetRule ?? settings.defaultBudgetRule;

  const [income, setIncome] = useState(String(monthBudget?.income ?? ""));
  const [needs, setNeeds] = useState(String(rule.needs));
  const [wants, setWants] = useState(String(rule.wants));
  const [saving, setSaving] = useState(String(rule.savings));
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  // Reset editable fields when the selected month or the settings loaded from Drive
  // change — an intentional sync from external state, not a render-cascade bug.
  useEffect(() => {
    const mb = settings.monthlyBudgets[month];
    const r = mb?.budgetRule ?? settings.defaultBudgetRule;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIncome(String(mb?.income ?? ""));
    setNeeds(String(r.needs));
    setWants(String(r.wants));
    setSaving(String(r.savings));
  }, [month, settings]);

  const handleSave = async () => {
    if (total !== 100) return;
    setIsSaving(true);
    setError(false);
    try {
      await updateSettings({
        ...settings,
        monthlyBudgets: {
          ...settings.monthlyBudgets,
          [month]: {
            month,
            income: parseFloat(income) || 0,
            budgetRule: {
              needs: parseFloat(needs) || 0,
              wants: parseFloat(wants) || 0,
              savings: parseFloat(saving) || 0,
            },
          },
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyDefaults = () => {
    const r = settings.defaultBudgetRule;
    setNeeds(String(r.needs));
    setWants(String(r.wants));
    setSaving(String(r.savings));
  };

  const total = (parseFloat(needs) || 0) + (parseFloat(wants) || 0) + (parseFloat(saving) || 0);
  const label = getMonthLabel(month, paydayOfMonth);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">This pay period</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-[65ch]">{label}</p>
        </div>
        {hasCustom ? (
          <Badge variant="outline" className="text-xs">Changed</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground max-w-[65ch]">Using Basics</Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-foreground"><h2>Pay this period</h2></CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-1.5">
          <Label htmlFor="income">Amount ({getDisplayCurrency().trim()})</Label>
          <Input id="income" type="number" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 2200" className="h-11 max-w-48" />
          <p className="text-xs text-muted-foreground max-w-[65ch]">
            What you expect to be paid this period. Once the payment shows up in your statement, the real amount is used instead.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground"><h2>Budget split</h2></CardTitle>
          {!hasCustom && (
            <button type="button" onClick={handleCopyDefaults} className="text-xs text-primary hover:underline">
              Start from Basics
            </button>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="needs">Needs %</Label>
            <Input id="needs" type="number" value={needs} onChange={(e) => setNeeds(e.target.value)} placeholder="50" className="h-11 max-w-28" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wants">Wants %</Label>
            <Input id="wants" type="number" value={wants} onChange={(e) => setWants(e.target.value)} placeholder="30" className="h-11 max-w-28" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="savings-pct">Savings %</Label>
            <Input id="savings-pct" type="number" value={saving} onChange={(e) => setSaving(e.target.value)} placeholder="20" className="h-11 max-w-28" />
          </div>
          <p className="text-xs text-muted-foreground max-w-[65ch]" aria-live="polite">
            Adds up to <span className={cn("font-mono tabular-nums font-medium", total !== 100 ? "text-destructive" : "text-foreground")}>{total}%</span>
            {total !== 100 && <span className="text-destructive">. It needs to be 100%.</span>}
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving || total !== 100} className={`w-full sm:w-auto sm:self-start sm:px-8 ${error ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>
        {error ? "Couldn't save. Try signing out and back in." : saved ? "Saved" : isSaving ? "Saving…" : `Save for ${label}`}
      </Button>
    </div>
  );
}
