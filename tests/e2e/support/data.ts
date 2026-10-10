/**
 * The test account: payday on the 1st, €2,000 pay split 50 / 30 / 20, rent paid
 * from another bank on the 20th, and statements from March to mid-June 2026.
 * "Today" is Monday 15 June 2026 (see env.ts).
 *
 * Figures the tests rely on, for the June pay period (1–30 June):
 *   Income        €2,000.00   (salary, recognised by the "acme" keyword)
 *   Spent so far    €187.99   Lidl 50 (Needs) · Netflix 12.99, Wolt 25, Zara 100 (Wants)
 *   Rent due        €800.00   on Sat 20 June
 *   Savings target  €400.00   (20% of pay, nothing saved yet)
 *   Safe to spend   €612.01   = 2000 − 187.99 − 800 − 400, about €38.25 a day for 16 days
 */

import type { Settings } from "@/types";

type Row = [type: string, date: string, description: string, amount: number, state?: string];

export function revolutCsv(rows: Row[]): string {
  const header = "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance";
  const lines = rows.map(([type, date, description, amount, state = "COMPLETED"]) =>
    `${type},Current,${date} 09:00:00,${date} 09:05:00,${description},${amount.toFixed(2)},0.00,EUR,${state},0.00`
  );
  return [header, ...lines].join("\n");
}

export const STATEMENT_CSV = revolutCsv([
  ["Card Payment", "2026-03-05", "Netflix", -12.99],
  ["Transfer", "2026-04-01", "Salary ACME Ltd", 2000],
  ["Card Payment", "2026-04-05", "Netflix", -12.99],
  ["Transfer", "2026-05-01", "Salary ACME Ltd", 2000],
  ["Card Payment", "2026-05-03", "Lidl", -40],
  ["Card Payment", "2026-05-05", "Netflix", -12.99],
  ["Card Payment", "2026-05-10", "Wolt", -20],
  ["Transfer", "2026-06-01", "Salary ACME Ltd", 2000],
  ["Card Payment", "2026-06-02", "Lidl", -50],
  ["Card Payment", "2026-06-05", "Netflix", -12.99],
  ["Card Payment", "2026-06-10", "Wolt", -25],
  ["Card Payment", "2026-06-12", "Zara", -100],
  // Not imported: a declined payment and a top-up.
  ["Card Payment", "2026-06-13", "Declined shop", -999, "DECLINED"],
  ["Topup", "2026-06-14", "Top-up", 500],
]);

export const SETTINGS: Settings = {
  currency: "EUR",
  paydayOfMonth: 1,
  defaultIncome: 2000,
  defaultBudgetRule: { needs: 50, wants: 30, savings: 20 },
  monthlyBudgets: {},
  salaryKeywords: ["acme"],
  selfTransferKeywords: [],
  savingsVaultKeywords: ["eur savings"],
  recurringPayments: [{ id: "rent", name: "Rent", amount: 800, dayOfMonth: 20, category: "Needs" }],
  onboarded: true,
  // Tours already seen, so their sheets don't cover the screens under test.
  tourPages: { dashboard: true, transactions: true, reports: true, settings: true },
  excludedSubscriptions: [],
  hiddenMerchants: [],
  recurringNudgeDismissed: false,
  settingsVersion: 2,
};

export const RULES = { v: 1, customized: true, rules: [{ keyword: "lidl", category: "Needs" }] };

/** The standard account, with optional changes to its settings or extra app data. */
export function account(overrides: { settings?: Partial<Settings>; manualTransactions?: object[] } = {}) {
  return {
    settings: { ...SETTINGS, ...overrides.settings },
    rules: RULES,
    manualTransactions: overrides.manualTransactions ?? [],
    statements: [{ name: "revolut-2026-06.csv", csv: STATEMENT_CSV }],
  };
}

/** A transaction the user typed in themselves. */
export function manualTransaction(fields: { id: string; date: string; description: string; amount: number; category: string }) {
  return {
    ...fields,
    type: "expense",
    currency: "EUR",
    source: "manual",
    categorySource: "manual",
    excluded: false,
  };
}
