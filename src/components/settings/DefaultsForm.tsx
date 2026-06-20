"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppData } from "@/contexts/AppDataContext";
import { ordinal } from "@/lib/utils";

export function DefaultsForm({ settings, updateSettings }: {
  settings: ReturnType<typeof useAppData>["settings"];
  updateSettings: ReturnType<typeof useAppData>["updateSettings"];
}) {
  const [payday, setPayday] = useState(String(settings.paydayOfMonth ?? 1));
  const [needs, setNeeds] = useState(String(settings.defaultBudgetRule.needs));
  const [wants, setWants] = useState(String(settings.defaultBudgetRule.wants));
  const [saving, setSaving] = useState(String(settings.defaultBudgetRule.savings));
  const [defaultIncome, setDefaultIncome] = useState(settings.defaultIncome ? String(settings.defaultIncome) : "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  // Intentional sync from externally-loaded settings.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPayday(String(settings.paydayOfMonth ?? 1));
    setNeeds(String(settings.defaultBudgetRule.needs));
    setWants(String(settings.defaultBudgetRule.wants));
    setSaving(String(settings.defaultBudgetRule.savings));
    setDefaultIncome(settings.defaultIncome ? String(settings.defaultIncome) : "");
  }, [settings]);

  const handleSave = async () => {
    if (total !== 100) return;
    setIsSaving(true);
    setError(false);
    const paydayNum = Math.min(28, Math.max(1, parseInt(payday) || 1));
    try {
      await updateSettings({
        ...settings,
        paydayOfMonth: paydayNum,
        defaultIncome: Math.max(0, parseFloat(defaultIncome) || 0),
        defaultBudgetRule: {
          needs: parseFloat(needs) || 0,
          wants: parseFloat(wants) || 0,
          savings: parseFloat(saving) || 0,
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

  const paydayNum = parseInt(payday) || 1;
  const total = (parseFloat(needs) || 0) + (parseFloat(wants) || 0) + (parseFloat(saving) || 0);
  const dirty =
    payday !== String(settings.paydayOfMonth ?? 1) ||
    needs !== String(settings.defaultBudgetRule.needs) ||
    wants !== String(settings.defaultBudgetRule.wants) ||
    saving !== String(settings.defaultBudgetRule.savings) ||
    defaultIncome !== (settings.defaultIncome ? String(settings.defaultIncome) : "");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Setup</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your pay cycle, default salary, and how to split your budget. Applied every month unless you override in Monthly.</p>
      </div>

      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pay Cycle</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-1.5">
          <Label htmlFor="payday">Payday (day of month)</Label>
          <Input id="payday" type="number" min={1} max={28} value={payday} onChange={(e) => setPayday(e.target.value)} placeholder="e.g. 24" className="h-11" />
          <p className="text-xs text-muted-foreground">
            Period starts on the {ordinal(paydayNum)}. Capped at 28 for shorter months.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Default Monthly Salary (€)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-1.5">
          <Label htmlFor="default-income">Amount</Label>
          <Input
            id="default-income"
            type="number"
            min={0}
            inputMode="decimal"
            value={defaultIncome}
            onChange={(e) => setDefaultIncome(e.target.value)}
            placeholder="e.g. 2000"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Used as your income for every period unless a specific month has its own planned income (set in the Budget tab). Leave blank to use the income detected from your statement.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Default Budget Split (%)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-needs">Needs %</Label>
            <Input id="d-needs" type="number" value={needs} onChange={(e) => setNeeds(e.target.value)} placeholder="30" className="h-11" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-wants">Wants %</Label>
            <Input id="d-wants" type="number" value={wants} onChange={(e) => setWants(e.target.value)} placeholder="60" className="h-11" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-savings">Savings %</Label>
            <Input id="d-savings" type="number" value={saving} onChange={(e) => setSaving(e.target.value)} placeholder="10" className="h-11" />
          </div>
          <p className="text-xs text-muted-foreground">
            These percentages set your spending targets. Needs covers essentials, Wants covers lifestyle, Savings covers the future.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Total: <span className={total !== 100 ? "text-destructive font-medium" : "text-emerald-600 dark:text-emerald-400 font-medium"}>{total}%</span>
            {total !== 100 && <span className="ml-1 text-destructive">— must equal 100%</span>}
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving || !dirty || total !== 100} className={`w-full ${error ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>
        {error ? "Save failed — sign out & back in" : saved ? "✓ Saved" : isSaving ? "Saving..." : "Save Defaults"}
      </Button>
    </div>
  );
}
