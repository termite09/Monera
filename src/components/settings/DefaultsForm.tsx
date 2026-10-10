"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ordinal, getDisplayCurrency } from "@/lib/utils";
import { useSaveStatus } from "@/hooks/useSaveStatus";
import type { Settings } from "@/types";
import { RecognisingPay } from "./RecognisingPay";
import { SaveButton } from "./SaveButton";
import { BudgetSplitFields, fromSplitDraft, splitTotal, toSplitDraft } from "./BudgetSplitFields";

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const incomeText = (n: number | undefined) => (n ? String(n) : "");

/** Basics: payday, standing pay, budget split and the keywords that recognise pay. Mount with a `key` to reset. */
export function DefaultsForm({ settings, updateSettings }: {
  settings: Settings;
  updateSettings: (s: Settings) => Promise<void>;
}) {
  const [payday, setPayday] = useState(String(settings.paydayOfMonth));
  const [split, setSplit] = useState(() => toSplitDraft(settings.defaultBudgetRule));
  const [defaultIncome, setDefaultIncome] = useState(incomeText(settings.defaultIncome));
  const [salary, setSalary] = useState(settings.salaryKeywords);
  const [selfTransfer, setSelfTransfer] = useState(settings.selfTransferKeywords);
  const [savingsVault, setSavingsVault] = useState(settings.savingsVaultKeywords);
  const { status, run } = useSaveStatus();

  const paydayNum = Math.min(31, Math.max(1, parseInt(payday, 10) || 1));
  const total = splitTotal(split);
  const savedSplit = toSplitDraft(settings.defaultBudgetRule);
  const dirty =
    payday !== String(settings.paydayOfMonth) ||
    split.needs !== savedSplit.needs || split.wants !== savedSplit.wants || split.savings !== savedSplit.savings ||
    defaultIncome !== incomeText(settings.defaultIncome) ||
    !sameList(salary, settings.salaryKeywords) ||
    !sameList(selfTransfer, settings.selfTransferKeywords) ||
    !sameList(savingsVault, settings.savingsVaultKeywords);

  const handleSave = () => {
    if (total !== 100) return;
    run(() =>
      updateSettings({
        ...settings,
        paydayOfMonth: paydayNum,
        defaultIncome: Math.max(0, parseFloat(defaultIncome) || 0),
        defaultBudgetRule: fromSplitDraft(split),
        salaryKeywords: salary,
        selfTransferKeywords: selfTransfer,
        savingsVaultKeywords: savingsVault,
      })
    );
  };

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
          <BudgetSplitFields idPrefix="basics" value={split} onChange={setSplit} showHints />
        </CardContent>
      </Card>

      <RecognisingPay
        salary={salary} setSalary={setSalary}
        selfTransfer={selfTransfer} setSelfTransfer={setSelfTransfer}
        savingsVault={savingsVault} setSavingsVault={setSavingsVault}
      />

      <SaveButton status={status} onClick={handleSave} disabled={!dirty || total !== 100} />
    </div>
  );
}
