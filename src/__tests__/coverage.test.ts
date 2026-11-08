import { describe, it, expect } from "vitest";
import { statementCoverage } from "@/lib/coverage";
import { parseCSV } from "@/lib/parser";
import type { StatementCoverage } from "@/types";

const range = (from: string, to: string, openingBalance: number, closingBalance: number): StatementCoverage =>
  ({ currency: "EUR", from, to, openingBalance, closingBalance });

describe("what the statements cover", () => {
  it("overlapping statements leave no gap", () => {
    expect(statementCoverage([range("2026-08-01", "2026-09-12", 156.66, 193.14), range("2026-09-01", "2026-10-04", 921.97, 115.28)], "EUR"))
      .toEqual({ from: "2026-08-01", to: "2026-10-04", gaps: [] });
  });

  it("days between statements aren't a gap when the balance didn't change across them", () => {
    expect(statementCoverage([range("2026-09-01", "2026-09-12", 100, 50), range("2026-09-20", "2026-09-30", 50, 10)], "EUR")!.gaps).toEqual([]);
  });

  it("reports the days in between when money moved there", () => {
    expect(statementCoverage([range("2026-09-01", "2026-09-13", 100, 50), range("2026-09-20", "2026-09-30", 80, 10)], "EUR")!.gaps)
      .toEqual([{ from: "2026-09-14", to: "2026-09-19" }]);
  });

  it("on consecutive days, names both days, since the missing payments settled on one of them", () => {
    expect(statementCoverage([range("2026-09-01", "2026-09-13", 100, 50), range("2026-09-14", "2026-09-30", 80, 10)], "EUR")!.gaps)
      .toEqual([{ from: "2026-09-13", to: "2026-09-14" }]);
  });

  it("only looks at the currency asked for", () => {
    expect(statementCoverage([range("2026-09-01", "2026-09-13", 1, 1)], "GBP")).toBeNull();
  });
});

describe("reading coverage from a Revolut export", () => {
  it("uses every settled row of the main account, top-ups and fees included", () => {
    const { coverage } = parseCSV([
      "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
      "Topup,Current,2026-10-14 14:37:40,2026-10-14 14:37:42,Top-up by *0747,100.00,0.00,EUR,COMPLETED,122.70",
      "Charge,Current,2026-10-15 04:27:46,2026-10-15 04:27:46,Metal plan fee,0.00,18.99,EUR,COMPLETED,103.71",
      "Card Payment,Current,2026-10-14 09:43:40,2026-10-15 11:10:58,Sklavenitis,-5.25,0.00,EUR,COMPLETED,98.46",
      "Card Payment,Current,2026-11-07 13:08:38,,Wolt,-15.34,0.00,EUR,PENDING,",
      "Interest,Deposit,2026-10-15 04:24:07,2026-10-15 04:24:07,Net Interest Paid,0.03,0.00,EUR,COMPLETED,553.71",
    ].join("\n"));
    expect(coverage).toEqual([{ currency: "EUR", from: "2026-10-14", to: "2026-10-15", openingBalance: 22.7, closingBalance: 98.46 }]);
  });
});
