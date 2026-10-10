import { describe, it, expect } from "vitest";
import { parseRevolutCSV } from "@/lib/parser/revolut";
import { generateId } from "@/lib/utils";
import { parseMoney } from "@/lib/parser/csv";
import { parseStatementDate } from "@/lib/parser/dates";
import { parseCSV } from "@/lib/parser";

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

  it("keeps PENDING rows (settlement can take days)", () => {
    const csv = [HEADER, makeRow({ State: "PENDING" })].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    expect(transactions).toHaveLength(1);
  });

  it("skips DECLINED, FAILED, and REVERTED rows", () => {
    const csv = [HEADER, makeRow({ State: "DECLINED" }), makeRow({ State: "FAILED" }), makeRow({ State: "REVERTED" })].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    expect(transactions).toHaveLength(0);
  });

  it("skips disallowed types", () => {
    const csv = [HEADER, makeRow({ Type: "EXCHANGE" })].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    expect(transactions).toHaveLength(0);
  });

  it("keeps self-transfer rows (internal-transfer filtering happens downstream)", () => {
    const csv = [HEADER, makeRow({ Description: "Alexandros Christou" })].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    expect(transactions).toHaveLength(1);
  });

  it("keeps savings vault rows (the positive mirror is dropped downstream)", () => {
    const csv = [HEADER, makeRow({ Description: "EUR Savings vault", Amount: "50.00" })].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    expect(transactions).toHaveLength(1);
  });

  it("keeps two genuinely identical same-day purchases as distinct transactions", () => {
    const row = makeRow({ Description: "Coffee Shop", Amount: "-3.50" });
    const csv = [HEADER, row, row].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    expect(transactions).toHaveLength(2);
    expect(transactions[0].id).not.toBe(transactions[1].id);
  });

  it("preserves the original id for the first occurrence (no migration needed)", () => {
    const csv = [HEADER, makeRow({ Description: "Coffee Shop", Amount: "-3.50" })].join("\n");
    const { transactions } = parseRevolutCSV(csv);
    // baseKey = `${date}|${description}|${amount}|${currency}` with amount = -3.5
    expect(transactions[0].id).toBe(generateId("2024-06-10|Coffee Shop|-3.5|EUR"));
  });

  it("returns empty for empty input", () => {
    const { transactions, errors } = parseRevolutCSV("");
    expect(transactions).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("parseMoney", () => {
  it("reads the formats banks use", () => {
    expect(parseMoney("-12.50")).toBe(-12.5);
    expect(parseMoney("1,234.56")).toBe(1234.56);
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("12,50")).toBe(12.5);
    expect(parseMoney("1,234")).toBe(1234);
    expect(parseMoney("€ -7.00")).toBe(-7);
  });

  it("returns NaN when there's no number", () => {
    expect(parseMoney("")).toBeNaN();
    expect(parseMoney("n/a")).toBeNaN();
  });
});

describe("parseStatementDate", () => {
  it("accepts ISO, European and (when unambiguous) US dates", () => {
    expect(parseStatementDate("2024-06-10 14:02:11")).toBe("2024-06-10");
    expect(parseStatementDate("10/06/2024")).toBe("2024-06-10");
    expect(parseStatementDate("06/30/2024")).toBe("2024-06-30");
    expect(parseStatementDate("31/02/2024")).toBeNull();
  });
});

describe("parseCSV — generic bank exports", () => {
  it("reads a debit/credit export with thousands separators", () => {
    const csv = 'Date,Details,Paid out,Paid in\n10/06/2024,Rent,"1,250.00",\n11/06/2024,Salary,,"2,400.00"';
    const { transactions } = parseCSV(csv);
    expect(transactions.map((t) => [t.description, t.type, t.amount])).toEqual([
      ["Rent", "expense", 1250],
      ["Salary", "income", 2400],
    ]);
  });
});
