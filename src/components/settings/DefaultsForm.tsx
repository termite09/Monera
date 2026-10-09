"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppData } from "@/contexts/AppDataContext";
import { ordinal, cn, getDisplayCurrency } from "@/lib/utils";
import { RecognisingPay } from "@/components/settings/RecognisingPay";

export function DefaultsForm({ settings, updateSettings }: {
  settings: ReturnType<typeof useAppData>["settings"];
  updateSettings: ReturnType<typeof useAppData>["updateSettings"];
}) {
  const [payday, setPayday] = useState(String(settings.paydayOfMonth ?? 1));
  const [needs, setNeeds] = useState(String(settings.defaultBudgetRule.needs));
  const [wants, setWants] = useState(String(settings.defaultBudgetRule.wants));
  const [saving, setSaving] = useState(String(settings.defaultBudgetRule.savings));
  const [defaultIncome, setDefaultIncome] = useState(settings.defaultIncome ? String(settings.defaultIncome) : "");
  const [salary, setSalary] = useState<string[]>(settings.salaryKeywords ?? []);
  const [selfTransfer, setSelfTransfer] = useState<string[]>(settings.selfTransferKeywords ?? []);
  const [savingsVault, setSavingsVault] = useState<string[]>(settings.savingsVaultKeywords ?? []);
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
    setSalary(settings.salaryKeywords ?? []);
    setSelfTransfer(settings.selfTransferKeywords ?? []);
    setSavingsVault(settings.savingsVaultKeywords ?? []);
  }, [settings]);

  const handleSave = async () => {
    if (total !== 100) return;
    setIsSaving(true);
    setError(false);
    const paydayNum = Math.min(31, Math.max(1, parseInt(payday) || 1));
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
        salaryKeywords: salary,
        selfTransferKeywords: selfTransfer,
        savingsVaultKeywords: savingsVault,
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
    defaultIncome !== (settings.defaultIncome ? String(settings.defaultIncome) : "") ||
    JSON.stringify(salary) !== JSON.stringify(settings.salaryKeywords ?? []) ||
    JSON.stringify(selfTransfer) !== JSON.stringify(settings.selfTransferKeywords ?? []) ||
    JSON.stringify(savingsVault) !== JSON.stringify(settings.savingsVaultKeywords ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Basics</h2>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-[65ch]">Used for every pay period, unless you change one under Period.</p>
      </div>

      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-lg font-semibold text-foreground"><h3>Payday</h3></CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-1.5">
          <Label htmlFor="payday">Day of the month you get paid</Label>
          <Input id="payday" type="number" inputMode="numeric" min={1} max={31} value={payday} onChange={(e) => setPayday(e.target.value)} placeholder="e.g. 24" className="h-11 max-w-48" />
          <p className="text-xs text-muted-foreground max-w-[65ch]">
            Each pay period starts on the {ordinal(paydayNum)}{paydayNum > 28 ? ", or the last day of shorter months" : ""}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-lg font-semibold text-foreground"><h3>Your pay</h3></CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-1.5">
          <Label htmlFor="default-income">Pay per period ({getDisplayCurrency().trim()})</Label>
          <Input
            id="default-income"
            type="number"
            min={0}
            inputMode="decimal"
            value={defaultIncome}
            onChange={(e) => setDefaultIncome(e.target.value)}
            placeholder="e.g. 2000"
            className="h-11 max-w-48 font-mono tabular-nums"
          />
          <p className="text-xs text-muted-foreground max-w-[65ch]">
            Used until your statement shows your pay.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-lg font-semibold text-foreground"><h3>Budget split</h3></CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-needs">Needs % <span className="font-normal text-muted-foreground">· rent, groceries, bills, transport</span></Label>
            <Input id="d-needs" type="number" value={needs} onChange={(e) => setNeeds(e.target.value)} placeholder="50" className="h-11 max-w-28" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-wants">Wants % <span className="font-normal text-muted-foreground">· eating out, shopping, subscriptions</span></Label>
            <Input id="d-wants" type="number" value={wants} onChange={(e) => setWants(e.target.value)} placeholder="30" className="h-11 max-w-28" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-savings">Savings % <span className="font-normal text-muted-foreground">· money you put aside or invest</span></Label>
            <Input id="d-savings" type="number" value={saving} onChange={(e) => setSaving(e.target.value)} placeholder="20" className="h-11 max-w-28" />
          </div>
          <p className="text-xs text-muted-foreground max-w-[65ch]" aria-live="polite">
            Adds up to <span className={cn("font-mono tabular-nums font-medium", total !== 100 ? "text-destructive" : "text-foreground")}>{total}%</span>
            {total !== 100 && <span className="text-destructive">. It needs to be 100%.</span>}
          </p>
        </CardContent>
      </Card>

      <RecognisingPay
        salary={salary} setSalary={setSalary}
        selfTransfer={selfTransfer} setSelfTransfer={setSelfTransfer}
        savingsVault={savingsVault} setSavingsVault={setSavingsVault}
      />

      <Button onClick={handleSave} disabled={isSaving || !dirty || total !== 100} className={"w-full sm:w-auto sm:self-start sm:px-8"}>
        {error ? "Couldn't save. Try signing out and back in." : saved ? "Saved" : isSaving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
