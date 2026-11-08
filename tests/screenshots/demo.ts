/**
 * A made-up account for the landing-page screenshots: nobody's real data.
 * Payday on the 24th, €2,100 pay, and three weeks of ordinary spending up to
 * Sunday 14 June 2026 ("today" is Monday 15 June, see tests/e2e/support/env.ts).
 */

import type { Settings } from "@/types";
import { SETTINGS } from "../e2e/support/data";

const HEADER = "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance";

// [type, product, started "YYYY-MM-DD HH:MM", description, amount]
type Row = [string, string, string, string, number];

const ROWS: Row[] = [
  ["Transfer", "Current", "2026-05-24 08:00", "Salary Northwind Ltd", 2100],
  ["Card Payment", "Current", "2026-05-24 11:20", "Lidl", -46.3],
  ["Transfer", "Current", "2026-05-25 09:00", "To EUR Holiday", -150],
  ["Transfer", "Deposit", "2026-05-25 09:00", "To EUR Holiday", 150],
  ["Card Payment", "Current", "2026-05-26 08:40", "Costa Coffee", -4.2],
  ["Card Payment", "Current", "2026-05-27 18:10", "PureGym", -34.99],
  ["Card Payment", "Current", "2026-05-28 19:05", "Bolt", -8.4],
  ["Card Payment", "Current", "2026-05-29 20:15", "Wolt", -21.8],
  ["Card Payment", "Current", "2026-05-30 10:30", "Shell", -48],
  ["Card Payment", "Current", "2026-05-30 21:00", "Trattoria Roma", -58],
  ["Card Payment", "Current", "2026-05-31 12:00", "Carrefour", -38.75],
  ["Card Payment", "Current", "2026-06-02 09:30", "Electricity Authority", -64.2],
  ["Card Payment", "Current", "2026-06-03 08:40", "Costa Coffee", -4.2],
  ["Card Payment", "Current", "2026-06-04 17:45", "Pharmacy Apollo", -12.6],
  ["Card Payment", "Current", "2026-06-05 04:10", "Netflix", -15.99],
  ["Card Payment", "Current", "2026-06-06 11:00", "IKEA", -86.4],
  ["Card Payment", "Current", "2026-06-06 19:30", "Cinema City", -22],
  ["Card Payment", "Current", "2026-06-06 22:10", "Wolt", -27.4],
  ["Card Payment", "Current", "2026-06-07 11:15", "Lidl", -52.1],
  ["Card Payment", "Current", "2026-06-09 10:00", "Dentist Dr Kyriacou", -60],
  ["Card Payment", "Current", "2026-06-09 19:20", "Bolt", -9.1],
  ["Card Payment", "Current", "2026-06-10 07:00", "Spotify", -10.99],
  ["Card Payment", "Current", "2026-06-11 16:30", "Zara", -49.95],
  ["Card Payment", "Current", "2026-06-12 08:40", "Costa Coffee", -4.2],
  ["Card Payment", "Current", "2026-06-12 18:00", "Shell", -48],
  ["Card Payment", "Current", "2026-06-13 21:00", "Trattoria Roma", -41.5],
  ["Card Payment", "Current", "2026-06-14 12:30", "Carrefour", -44.8],
];

/** The statement as Revolut would export it, with running balances so coverage checks out. */
function statementCsv(): string {
  let current = 312.4;
  let vault = 600;
  const lines = ROWS.map(([type, product, started, description, amount]) => {
    const balance = product === "Current" ? (current = Math.round((current + amount) * 100) / 100) : (vault = Math.round((vault + amount) * 100) / 100);
    const completed = type === "Card Payment" ? `${started.slice(0, 10)} 23:59:00` : `${started}:05`;
    return `${type},${product},${started}:00,${completed},${description},${amount.toFixed(2)},0.00,EUR,COMPLETED,${balance.toFixed(2)}`;
  });
  return [HEADER, ...lines].join("\n");
}

const SETTINGS_DEMO: Settings = {
  ...SETTINGS,
  paydayOfMonth: 24,
  defaultIncome: 2100,
  defaultBudgetRule: { needs: 50, wants: 30, savings: 20 },
  salaryKeywords: ["northwind"],
  recurringPayments: [
    { id: "mobile", name: "Mobile plan", amount: 25, dayOfMonth: 5, category: "Needs" },
    { id: "car", name: "Car insurance", amount: 129, dayOfMonth: 22, category: "Needs" },
  ],
  tourPages: { dashboard: true, transactions: true, reports: true, settings: true },
};

const RULES_DEMO = {
  v: 1,
  customized: true,
  rules: ["lidl", "carrefour", "electricity", "pharmacy", "bolt", "shell", "dentist"].map((keyword) => ({ keyword, category: "Needs" })),
};

export function demoAccount() {
  return {
    settings: SETTINGS_DEMO,
    rules: RULES_DEMO,
    statements: [{ name: "account-statement_2026-05-24_2026-06-14.csv", csv: statementCsv() }],
  };
}
