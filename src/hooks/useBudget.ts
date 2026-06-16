import { useState, useEffect, useCallback } from "react";
import { Settings, MonthSummary, Transaction } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { DEFAULT_SETTINGS } from "@/config/constants";
import { getPeriodBounds } from "@/lib/utils";

export function useBudget(
  accessToken: string | undefined,
  structure: DriveStructure | null,
  transactions: Transaction[],
  month: string
) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!accessToken || !structure) return;

    const load = async () => {
      setIsLoading(true);
      try {
        const s = await readAppFile<Settings>(accessToken, structure.fileIds.settings);
        setSettings(s);
      } catch {
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [accessToken, structure]);

  const paydayOfMonth = settings.paydayOfMonth ?? 1;
  const { start, end } = getPeriodBounds(month, paydayOfMonth);
  const inPeriod = (tx: Transaction) => {
    const d = new Date(tx.date + "T00:00:00");
    return d >= start && d <= end;
  };
  const monthTxs = transactions.filter((tx) => inPeriod(tx) && tx.type === "expense");
  const monthIncomeTxs = transactions.filter((tx) => inPeriod(tx) && tx.type === "income");

  const monthBudget = settings.monthlyBudgets[month];
  const budgetRule = monthBudget?.budgetRule ?? settings.defaultBudgetRule;
  const income = monthBudget?.income ?? 0;

  const summary: MonthSummary = {
    income: monthIncomeTxs.reduce((s, t) => s + t.amount, 0) || income,
    totalExpenses: monthTxs.reduce((s, t) => s + t.amount, 0),
    needs: monthTxs.filter((t) => t.category === "Needs").reduce((s, t) => s + t.amount, 0),
    wants: monthTxs.filter((t) => t.category === "Wants").reduce((s, t) => s + t.amount, 0),
    savings: monthTxs.filter((t) => t.category === "Savings").reduce((s, t) => s + t.amount, 0),
    remaining: 0,
  };
  summary.remaining = summary.income - summary.totalExpenses;

  const budgetAllocations = {
    needs: (summary.income * budgetRule.needs) / 100,
    wants: (summary.income * budgetRule.wants) / 100,
    savings: (summary.income * budgetRule.savings) / 100,
  };

  const updateSettings = useCallback(
    async (newSettings: Settings) => {
      if (!accessToken || !structure) return;
      await writeAppFile(accessToken, structure.fileIds.settings, newSettings);
      setSettings(newSettings);
    },
    [accessToken, structure]
  );

  return {
    settings,
    paydayOfMonth,
    summary,
    budgetAllocations,
    budgetRule,
    isLoading,
    updateSettings,
  };
}
