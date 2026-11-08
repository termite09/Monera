import { describe, it, expect } from "vitest";
import { parseCSV } from "@/lib/parser";
import { isLeftOut, mergeTransactions } from "@/lib/dedup";
import { filterInternalTransfers } from "@/lib/transfers";
import { applyCategorizationRules } from "@/lib/categorizer";
import { netExpenseByCategory } from "@/lib/finance";
import { DEFAULT_SETTINGS } from "@/config/constants";

// Rows taken from real overlapping Revolut exports (Aug–Nov 2026).
const H = "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance";
const csv = (...rows: string[]) => [H, ...rows].join("\n");

const OLDER = csv(
  "Card Payment,Current,2026-10-07 18:03:14,2026-10-09 11:11:13,Delivery Hero,-2.89,0.00,EUR,COMPLETED,48.12",
  "Card Payment,Current,2026-09-06 09:20:45,2026-09-07 11:08:37,Αλφα μέγα,-80.23,0.00,EUR,COMPLETED,12.14",
  "Card Payment,Current,2026-10-25 09:13:24,,Esso,-40.00,0.00,EUR,PENDING,",
  "Transfer,Current,2026-10-31 11:35:58,,To investment account,-200.65,0.00,EUR,PENDING,",
);
const NEWER = csv(
  "Card Payment,Current,2026-10-07 18:03:14,2026-10-09 11:11:13,foody,-2.89,0.00,EUR,COMPLETED,48.12",
  "Card Payment,Current,2026-09-06 09:20:45,2026-09-07 11:08:37,AlphaMega,-80.23,0.00,EUR,COMPLETED,12.14",
  "Card Payment,Current,2026-10-25 09:13:24,2026-10-27 12:17:21,Strovolos Avenue,-40.00,0.00,EUR,COMPLETED,32.95",
  "Transfer,Current,2026-10-31 11:35:58,2026-11-02 16:34:01,To investment account,-200.65,0.00,EUR,COMPLETED,385.81",
  "Transfer,Current,2026-10-31 11:36:35,2026-11-02 16:32:35,To investment account,-200.65,0.00,EUR,COMPLETED,586.46",
);

describe("overlapping Revolut exports", () => {
  // The newest upload comes first, as the app lists statement files.
  const merged = mergeTransactions([...parseCSV(NEWER).transactions, ...parseCSV(OLDER).transactions], []);
  const named = (d: string) => merged.filter((t) => t.date === d).map((t) => t.description);

  it("counts a payment once even when Revolut renamed the shop between exports", () => {
    expect(named("2026-10-07")).toEqual(["foody"]);
    expect(named("2026-09-06")).toEqual(["AlphaMega"]);
    expect(named("2026-10-25")).toEqual(["Strovolos Avenue"]); // settled name wins over the pending one
    expect(merged.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(2.89 + 80.23 + 40 + 200.65 * 2);
  });

  it("keeps two genuinely separate payments of the same amount", () => {
    expect(merged.filter((t) => t.description === "To investment account")).toHaveLength(2);
  });

  it("a merged payment is left out only if every copy was", () => {
    const foody = merged.find((t) => t.description === "foody")!;
    const oldId = foody.aliases![0];
    // Leaving out the old copy was a way round the duplicate: the purchase still counts.
    expect(isLeftOut(foody, new Set([oldId]))).toBe(false);
    expect(isLeftOut(foody, new Set([foody.id]))).toBe(false);
    expect(isLeftOut(foody, new Set([foody.id, oldId]))).toBe(true);
    // Transactions that were never duplicated work as before.
    const alphaMega = merged.find((t) => t.description === "AlphaMega")!;
    expect(isLeftOut({ ...alphaMega, aliases: undefined }, new Set([alphaMega.id]))).toBe(true);
  });

  it("remembers the older ids, so a change saved under one still applies", () => {
    const foody = merged.find((t) => t.description === "foody")!;
    const oldId = parseCSV(OLDER).transactions.find((t) => t.description === "Delivery Hero")!.id;
    expect(foody.aliases).toEqual([oldId]);
    const [categorized] = applyCategorizationRules([foody], [], { [oldId]: "Needs" });
    expect(categorized.category).toBe("Needs");
  });
});

describe("Revolut row types", () => {
  const txs = parseCSV(csv(
    "Charge,Current,2026-10-15 04:27:46,2026-10-15 04:27:46,Metal plan fee,0.00,18.99,EUR,COMPLETED,103.71",
    "Rev Payment,Current,2026-11-02 14:11:07,2026-11-02 14:11:08,www.skroutz.gr*Nea Ionia,-249.90,0.00,EUR,COMPLETED,537.21",
    "Rev Payment Refund,Current,2026-11-02 15:40:27,2026-11-02 15:40:27,Refund from Skroutz,249.90,0.00,EUR,COMPLETED,787.11",
    "Topup,Current,2026-11-01 07:42:25,2026-11-01 07:42:42,Top-up by *0747,560.00,0.00,EUR,COMPLETED,1113.01",
    "Interest,Deposit,2026-10-01 04:01:54,2026-10-01 04:01:54,Net Interest Paid,0.02,0.01,EUR,COMPLETED,553.38",
  )).transactions;

  it("counts the fee column: the Metal plan fee is €18.99 spent, not a €0 row", () => {
    const fee = txs.find((t) => t.description === "Metal plan fee")!;
    expect(fee).toMatchObject({ type: "expense", amount: 18.99 });
  });

  it("keeps refund rows, and nets a refund against the purchase it pays back", () => {
    const refund = txs.find((t) => t.description === "Refund from Skroutz")!;
    expect(refund).toMatchObject({ type: "income", amount: 249.9, refund: true });
    const categorized = applyCategorizationRules(txs, [], {});
    expect(categorized.find((t) => t.refund)!.category).toBe("Wants"); // same as the Skroutz purchase
    const spent = netExpenseByCategory(categorized.filter((t) => t.description !== "Metal plan fee"));
    expect(spent.Wants).toBe(0);
  });

  it("still skips top-ups and interest", () => {
    expect(txs.map((t) => t.description)).not.toContain("Top-up by *0747");
    expect(txs.map((t) => t.description)).not.toContain("Net Interest Paid");
  });
});

describe("savings and money from friends", () => {
  const txs = parseCSV(csv(
    "Transfer,Current,2026-11-01 07:43:43,2026-11-01 07:43:43,To EUR Savings for weddings,-50.00,0.00,EUR,COMPLETED,503.01",
    "Transfer,Deposit,2026-11-01 07:43:43,2026-11-01 07:43:43,To EUR Savings for weddings,50.00,0.00,EUR,COMPLETED,604.10",
    "Transfer,Current,2026-10-31 11:35:58,2026-11-02 16:34:01,To investment account,-200.65,0.00,EUR,COMPLETED,385.81",
    "Card Payment,Current,2026-10-17 19:35:59,2026-10-18 12:44:48,Wolt,-61.04,0.00,EUR,COMPLETED,151.14",
    "Transfer,Current,2026-10-17 21:39:02,2026-10-17 21:39:03,Transfer from Angelos Demosthenous,13.40,0.00,EUR,COMPLETED,188.07",
  )).transactions;
  const keywords = DEFAULT_SETTINGS.savingsVaultKeywords;
  const visible = filterInternalTransfers(txs, { savingsVaultKeywords: keywords });

  it("counts money moved to the vault or an investment account as Savings, once", () => {
    const categorized = applyCategorizationRules(visible, [], {}, { savingsKeywords: keywords });
    expect(netExpenseByCategory(categorized).Savings).toBe(250.65);
  });

  it("money back from a friend is income unless the user says it pays back spending", () => {
    const asIncome = applyCategorizationRules(visible, [], {}, { savingsKeywords: keywords });
    expect(asIncome.find((t) => t.description.startsWith("Transfer from"))!.category).toBe("Uncategorized");

    const asRepayment = applyCategorizationRules(visible, [], {}, { savingsKeywords: keywords, repaymentsReduceSpending: true });
    expect(netExpenseByCategory(asRepayment).Wants).toBe(47.64); // 61.04 − 13.40
  });

  it("pay matching a salary keyword stays income even then", () => {
    const [pay] = applyCategorizationRules(
      parseCSV(csv("Transfer,Current,2026-11-01 08:00:00,2026-11-01 08:00:01,Transfer from ACME LTD,2000.00,0.00,EUR,COMPLETED,2100.00")).transactions,
      [], {}, { repaymentsReduceSpending: true, salaryKeywords: ["acme"] }
    );
    expect(pay.category).toBe("Uncategorized");
  });
});

describe("pending, settled and reverted rows", () => {
  it("matches a pending row to its settled row even when the amount changed, keeping the settled amount", () => {
    // A fuel pre-authorisation that settled for more.
    const older = parseCSV(csv("Card Payment,Current,2026-08-27 17:40:08,,Esso,-40.00,0.00,EUR,PENDING,")).transactions;
    const newer = parseCSV(csv("Card Payment,Current,2026-08-27 17:40:08,2026-08-29 11:04:16,Esso,-52.01,0.00,EUR,COMPLETED,3.14")).transactions;
    const merged = mergeTransactions([...newer, ...older], []);
    expect(merged.map((t) => t.amount)).toEqual([52.01]);
    expect(merged[0].pending).toBeUndefined();
  });

  it("drops a pending payment that a later export shows reverted, but never a settled one", () => {
    const pending = parseCSV(csv("Card Payment,Current,2026-09-06 10:58:16,,Bolt Food,-7.83,0.00,EUR,PENDING,"));
    const reverted = parseCSV(csv("Card Payment,Current,2026-09-06 10:58:16,,Bolt Food,-7.83,0.00,EUR,REVERTED,"));
    expect(reverted.transactions).toEqual([]);
    expect(mergeTransactions(pending.transactions, [], reverted.cancelled)).toEqual([]);

    const settled = parseCSV(csv("Card Payment,Current,2026-09-06 10:58:16,2026-09-07 11:00:00,Bolt Food,-7.83,0.00,EUR,COMPLETED,10.00"));
    expect(mergeTransactions([...settled.transactions, ...pending.transactions], [], reverted.cancelled)).toHaveLength(1);
  });

  it("marks rows that weren't settled yet when exported", () => {
    const [row] = parseCSV(csv("Card Payment,Current,2026-11-08 09:30:05,,AlphaMega,-69.39,0.00,EUR,PENDING,")).transactions;
    expect(row.pending).toBe(true);
  });
});

describe("savings vaults, whatever they're called", () => {
  const txs = parseCSV(csv(
    "Transfer,Current,2026-11-01 07:43:43,2026-11-01 07:43:43,To EUR Holiday,-100.00,0.00,EUR,COMPLETED,400.00",
    "Transfer,Deposit,2026-11-01 07:43:43,2026-11-01 07:43:43,To EUR Holiday,100.00,0.00,EUR,COMPLETED,600.00",
    "Transfer,Current,2026-11-05 10:00:00,2026-11-05 10:00:01,From EUR Holiday,40.00,0.00,EUR,COMPLETED,440.00",
    "Transfer,Deposit,2026-11-05 10:00:00,2026-11-05 10:00:01,From EUR Holiday,-40.00,0.00,EUR,COMPLETED,560.00",
    "Transfer,Current,2026-11-05 10:00:00,2026-11-05 10:00:02,Transfer to ANDREAS NEOPHITOU,-5.50,0.00,EUR,COMPLETED,434.50",
  )).transactions;

  it("counts money into a vault once, as Savings, with no keywords set", () => {
    const [toVault] = applyCategorizationRules(txs.filter((t) => t.description === "To EUR Holiday"), [], {}, { savingsKeywords: [] });
    expect(txs.filter((t) => t.description === "To EUR Holiday")).toHaveLength(1);
    expect(toVault).toMatchObject({ type: "expense", amount: 100, category: "Savings" });
  });

  it("drops money taken back out of a vault: it's your own money either way", () => {
    expect(txs.map((t) => t.description)).not.toContain("From EUR Holiday");
  });

  it("leaves other transfers at the same second alone", () => {
    expect(txs.find((t) => t.description.startsWith("Transfer to"))).toMatchObject({ amount: 5.5, type: "expense" });
  });
});
