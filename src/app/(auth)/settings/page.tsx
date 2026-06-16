"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useDrive } from "@/hooks/useDrive";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudget } from "@/hooks/useBudget";
import { getCurrentMonth } from "@/lib/utils";

export default function SettingsPage() {
  const { accessToken } = useAuth();
  const { structure } = useDrive(accessToken);
  const [month, setMonth] = useState(getCurrentMonth());
  const { transactions } = useTransactions(accessToken, structure);
  const { settings, budgetRule, updateSettings } = useBudget(accessToken, structure, transactions, month);

  const [income, setIncome] = useState("");
  const [needs, setNeeds] = useState("");
  const [wants, setWants] = useState("");
  const [saving, setSaving] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const monthBudget = settings.monthlyBudgets[month];
    setIncome(String(monthBudget?.income ?? ""));
    setNeeds(String(budgetRule.needs));
    setWants(String(budgetRule.wants));
    setSaving(String(budgetRule.savings));
  }, [settings, month, budgetRule]);

  const handleSave = async () => {
    setIsSaving(true);
    const updated = {
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
    };
    await updateSettings(updated);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const total = (parseFloat(needs) || 0) + (parseFloat(wants) || 0) + (parseFloat(saving) || 0);

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Budget Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your monthly budget for {month}</p>
        </div>

        <Card className="shadow-none border-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Monthly Income
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-1.5">
            <Label htmlFor="income">Income (€)</Label>
            <Input id="income" type="number" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 2200" className="h-11" />
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Budget Rule (%)
            </CardTitle>
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
            <p className="text-xs text-muted-foreground mt-1">
              Total: <span className={total !== 100 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-emerald-600 dark:text-emerald-400 font-medium"}>{total}%</span>
              {total !== 100 && <span className="ml-1">— should equal 100%</span>}
            </p>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={isSaving} className="w-full bg-primary text-primary-foreground">
          {saved ? "✓ Saved" : isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </PageShell>
  );
}
