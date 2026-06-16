"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
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
  const [saving2, setSaving2] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const monthBudget = settings.monthlyBudgets[month];
    setIncome(String(monthBudget?.income ?? ""));
    setNeeds(String(budgetRule.needs));
    setWants(String(budgetRule.wants));
    setSaving(String(budgetRule.savings));
  }, [settings, month, budgetRule]);

  const handleSave = async () => {
    setSaving2(true);
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
    setSaving2(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} />

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Budget Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your monthly budget</p>
        </div>

        <Card>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Monthly Income</h2>
          <Input
            label="Income (€)"
            type="number"
            value={income}
            onChange={setIncome}
            placeholder="e.g. 2200"
          />
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Budget Rule (%)</h2>
          <div className="space-y-3">
            <Input label="Needs %" type="number" value={needs} onChange={setNeeds} placeholder="30" />
            <Input label="Wants %" type="number" value={wants} onChange={setWants} placeholder="60" />
            <Input label="Savings %" type="number" value={saving} onChange={setSaving} placeholder="10" />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Total: {(parseFloat(needs) || 0) + (parseFloat(wants) || 0) + (parseFloat(saving) || 0)}%
            {(parseFloat(needs) || 0) + (parseFloat(wants) || 0) + (parseFloat(saving) || 0) !== 100 && (
              <span className="text-amber-500 ml-1">should equal 100%</span>
            )}
          </p>
        </Card>

        <Button onClick={handleSave} disabled={saving2} fullWidth>
          {saved ? "Saved" : saving2 ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </PageShell>
  );
}
