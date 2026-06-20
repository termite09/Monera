"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAppData } from "@/contexts/AppDataContext";
import { getMonthLabel } from "@/lib/utils";
import { Category } from "@/types";

const CATEGORIES: Category[] = ["Needs", "Wants", "Savings"];

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
          <h1 className="text-xl font-semibold text-foreground">Budget Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
        </div>
        {hasCustom ? (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 dark:border-emerald-800">Custom</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">Using defaults</Badge>
        )}
      </div>

      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Planned Income</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-1.5">
          <Label htmlFor="income">Amount (€)</Label>
          <Input id="income" type="number" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 2200" className="h-11" />
          <p className="text-xs text-muted-foreground">
            Your expected income for this period. Leave blank to use the income detected in your statement. Drives the budget split and remaining balance.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Budget Split (%)</CardTitle>
          {!hasCustom && (
            <button onClick={handleCopyDefaults} className="text-xs text-primary hover:underline">
              Copy defaults
            </button>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="needs">Needs %</Label>
            <Input id="needs" type="number" value={needs} onChange={(e) => setNeeds(e.target.value)} placeholder="30" className="h-11" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wants">Wants %</Label>
            <Input id="wants" type="number" value={wants} onChange={(e) => setWants(e.target.value)} placeholder="60" className="h-11" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="savings-pct">Savings %</Label>
            <Input id="savings-pct" type="number" value={saving} onChange={(e) => setSaving(e.target.value)} placeholder="10" className="h-11" />
          </div>
          <p className="text-xs text-muted-foreground">Override the budget percentages for just this month. Other months still use your defaults.</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Total: <span className={total !== 100 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-emerald-600 dark:text-emerald-400 font-medium"}>{total}%</span>
            {total !== 100 && <span className="ml-1">— should equal 100%</span>}
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving} className={`w-full ${error ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>
        {error ? "Save failed — sign out & back in" : saved ? "✓ Saved" : isSaving ? "Saving..." : `Save for ${label}`}
      </Button>
    </div>
  );
}
