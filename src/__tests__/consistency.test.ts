import { describe, it, expect } from "vitest";
import { netExpenseTotal } from "@/lib/finance";
import { useBudget } from "@/hooks/useBudget";
import { buildReport, monthlyCategoryTotals } from "@/lib/reports";
import { getRecurringTransactions } from "@/lib/recurring";
import { getPeriodBounds } from "@/lib/utils";
import { Transaction, Settings, RecurringPayment } from "@/types";

const MONTH = "2024-06";
const PAYDAY = 1;

const settings: Settings = {
  currency: "€",
  paydayOfMonth: PAYDAY,
  defaultBudgetRule: { needs: 30, wants: 60, savings: 10 },
  monthlyBudgets: {},
  salaryKeywords: [],
  selfTransferKeywords: [],
  savingsVaultKeywords: [],
  recurringPayments: [],
};

const rent: RecurringPayment = { id: "rent", name: "Rent", amount: 800, dayOfMonth: 1, category: "Needs" };

let seq = 0;
function tx(p: Partial<Transaction> & { amount: number; type: Transaction["type"] }): Transaction {
  return {
    id: `t${seq++}`,
    date: "2024-06-05",
    description: "x",
    currency: "EUR",
    category: "Wants",
    source: "revolut",
    categorySource: "auto",
    ...p,
  };
}

// One period containing: salary, multi-category expenses, a refund, a manual
// transaction, an excluded expense, and (merged in) a recurring bill.
function buildFixture(withManual = true) {
  const base: Transaction[] = [
    tx({ amount: 2000, type: "income", category: "Uncategorized", date: "2024-06-01", description: "Salary" }),
    tx({ amount: 200, type: "expense", category: "Needs", date: "2024-06-02" }),
    tx({ amount: 100, type: "expense", category: "Wants", date: "2024-06-05" }),
    tx({ amount: 30, type: "income", category: "Wants", date: "2024-06-06", description: "Refund" }),
    tx({ amount: 150, type: "expense", category: "Savings", date: "2024-06-10" }),
    tx({ amount: 500, type: "expense", category: "Needs", date: "2024-06-15", excluded: true }),
  ];
  if (withManual) {
    base.push(tx({ amount: 40, type: "expense", category: "Wants", date: "2024-06-12", source: "manual", categorySource: "manual" }));
  }
  const recurring = getRecurringTransactions([rent], MONTH, PAYDAY, "EUR");
  return [...base, ...recurring];
}

function periodScoped(txs: Transaction[]): Transaction[] {
  const { start, end } = getPeriodBounds(MONTH, PAYDAY);
  return txs.filter((t) => {
    const d = new Date(t.date + "T00:00:00");
    return d >= start && d <= end;
  });
}

describe("cross-page spending consistency", () => {
  it("dashboard, reports, and transactions net totals all agree", () => {
    const allTxs = buildFixture();
    const dashboard = useBudget(allTxs, settings, MONTH).summary.totalExpenses;
    const reports = buildReport(allTxs, MONTH, PAYDAY).totalSpent;
    const transactionsPage = netExpenseTotal(periodScoped(allTxs));

    // Needs 200+800, Wants (100+40)-30, Savings 150, excluded 500 ignored, salary not counted
    expect(dashboard).toBe(1260);
    expect(reports).toBe(1260);
    expect(transactionsPage).toBe(1260);
  });

  it("year overview month total matches the dashboard category figures", () => {
    const allTxs = buildFixture();
    const june = monthlyCategoryTotals(allTxs, 2024, PAYDAY)[5]; // index 5 = June
    expect(june.needs).toBe(1000);
    expect(june.wants).toBe(110);
    expect(june.savings).toBe(150);
    expect(june.needs + june.wants + june.savings).toBe(1260);
  });

  it("the manual transaction is counted everywhere (drop it -> every total falls by 40)", () => {
    const without = buildFixture(false);
    expect(useBudget(without, settings, MONTH).summary.totalExpenses).toBe(1220);
    expect(buildReport(without, MONTH, PAYDAY).totalSpent).toBe(1220);
    expect(netExpenseTotal(periodScoped(without))).toBe(1220);
  });

  it("the recurring bill is counted everywhere (without it Needs falls by 800)", () => {
    const noRecurring = buildFixture().filter((t) => t.source !== "recurring");
    expect(monthlyCategoryTotals(noRecurring, 2024, PAYDAY)[5].needs).toBe(200);
    expect(buildReport(noRecurring, MONTH, PAYDAY).totalSpent).toBe(460); // 200 + 110 + 150
  });

  it("the refund reduces Wants identically across surfaces", () => {
    const allTxs = buildFixture();
    expect(useBudget(allTxs, settings, MONTH).summary.wants).toBe(110);
    expect(monthlyCategoryTotals(allTxs, 2024, PAYDAY)[5].wants).toBe(110);
  });
});
