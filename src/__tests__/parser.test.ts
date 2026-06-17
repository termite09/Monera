import { describe, it, expect } from "vitest";
import { parseRevolutCSV } from "@/lib/parser/revolut";

const HEADER = "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance";

function makeRow(overrides: Partial<Record<string, string>> = {}): string {
  const defaults: Record<string, string> = {
    Type: "CARD_PAYMENT",
    Product: "Current",
    "Started Date": "2024-06-10 12:00:00",
    "Completed Date": "2024-06-10 12:00:00",
    Description: "Lidl Nicosia",
    Amount: "-15.50",
    Fee: "0.00",
    Currency: "EUR",
    State: "COMPLETED",
    Balance: "500.00",
  };
  const row = { ...defaults, ...overrides };
  return Object.values(row).join(",");
}

describe("parseRevolutCSV", () => {
  it("parses a valid expense row", () => {
    const csv = [HEADER, makeRow()].join("\n");
    const { transactions, errors } = parseRevolutCSV(csv);
    expect(errors).toHaveLength(0);
    expect(transactions).toHaveLength(1);
    const [tx] = transactions;
    expect(tx.type).toBe("expense");
    expect(tx.amount).toBe(15.5);
    expect(tx.description).toBe("Lidl Nicosia");
    expect(tx.currency).toBe("EUR");
  });

  it("parses income (positive amount) correctly", () => {
    const csv = [HEADER, makeRow({ Amount: "1200.00", Type: "TRANSFER", Description: "Salary" })].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    expect(transactions[0].type).toBe("income");
    expect(transactions[0].amount).toBe(1200);
  });

  it("skips PENDING rows", () => {
    const csv = [HEADER, makeRow({ State: "PENDING" })].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    expect(transactions).toHaveLength(0);
  });

  it("skips disallowed types", () => {
    const csv = [HEADER, makeRow({ Type: "EXCHANGE" })].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    expect(transactions).toHaveLength(0);
  });

  it("skips self-transfers", () => {
    const csv = [HEADER, makeRow({ Description: "Alexandros Christou" })].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    expect(transactions).toHaveLength(0);
  });

  it("skips positive savings vault entries (mirror of outgoing)", () => {
    const csv = [HEADER, makeRow({ Description: "EUR Savings vault", Amount: "50.00" })].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    expect(transactions).toHaveLength(0);
  });

  it("returns empty for empty input", () => {
    const { transactions, errors } = parseRevolutCSV("");
    expect(transactions).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
});
