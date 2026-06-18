import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { isSpreadsheet, csvFileName, readSpreadsheetAsCsv } from "@/lib/spreadsheet";
import { parseCSV } from "@/lib/parser";

function fileLike(name: string, text: string): { name: string; text: () => Promise<string>; arrayBuffer: () => Promise<ArrayBuffer> } {
  return {
    name,
    text: async () => text,
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

function xlsxFile(name: string, rows: (string | number | Date)[][]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { name, text: async () => "", arrayBuffer: async () => buf };
}

describe("spreadsheet helpers", () => {
  it("detects spreadsheet extensions case-insensitively", () => {
    expect(isSpreadsheet("statement.xlsx")).toBe(true);
    expect(isSpreadsheet("statement.XLS")).toBe(true);
    expect(isSpreadsheet("statement.csv")).toBe(false);
  });

  it("maps a spreadsheet name to a .csv name", () => {
    expect(csvFileName("revolut.xlsx")).toBe("revolut.csv");
    expect(csvFileName("revolut.csv")).toBe("revolut.csv");
  });

  it("passes CSV files through untouched", async () => {
    const out = await readSpreadsheetAsCsv(fileLike("x.csv", "a,b\n1,2"));
    expect(out).toBe("a,b\n1,2");
  });

  it("converts a Revolut-style xlsx so the existing parser understands it", async () => {
    const rows: (string | number | Date)[][] = [
      ["Type", "Product", "Started Date", "Completed Date", "Description", "Amount", "Fee", "Currency", "State", "Balance"],
      ["CARD_PAYMENT", "Current", new Date("2024-06-10T12:00:00Z"), new Date("2024-06-10T12:00:00Z"), "Lidl Nicosia", -15.5, 0, "EUR", "COMPLETED", 500],
    ];
    const csv = await readSpreadsheetAsCsv(xlsxFile("revolut.xlsx", rows));
    const { transactions } = parseCSV(csv);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].date).toBe("2024-06-10");
    expect(transactions[0].amount).toBe(15.5);
    expect(transactions[0].type).toBe("expense");
  });
});
