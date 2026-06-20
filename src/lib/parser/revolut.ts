import { Transaction, ParsedCSV } from "@/types";
import { parseRevolutDate, normalizeAmount } from "./dates";
import { occurrenceId } from "@/lib/utils";

interface RevolutRow {
  Type: string;
  Product: string;
  "Started Date": string;
  "Completed Date": string;
  Description: string;
  Amount: string;
  Fee: string;
  Currency: string;
  State: string;
  Balance: string;
}

// Only these transaction types are imported. Everything else (Topup, Interest,
// Exchange, Fee, etc.) is ignored. Normalized by uppercasing and stripping
// spaces/underscores so both "Card payment" and "CARD_PAYMENT" match.
const ALLOWED_TYPES = new Set([
  "CARDPAYMENT",
  "CARDREFUND",
  "CHARGE",
  "REVPAYMENT",
  "TRANSFER",
]);

function normalizeType(type: string): string {
  return type.toUpperCase().replace(/[\s_]/g, "");
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } // RFC 4180 escaped quote
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseRevolutCSV(csvContent: string): ParsedCSV {
  const lines = csvContent.split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    return { transactions: [], errors: ["Empty or invalid CSV file"] };
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/"/g, "").trim());
  const transactions: Transaction[] = [];
  const errors: string[] = [];
  // Counts identical dedup keys within this file so repeat purchases stay distinct.
  const counts = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.replace(/"/g, "").trim() ?? "";
    });

    const typedRow = row as unknown as RevolutRow;

    if (typedRow.State?.toUpperCase() !== "COMPLETED") continue;

    // Skip transaction types we don't track (Topup, Interest, Exchange, etc.)
    if (!ALLOWED_TYPES.has(normalizeType(typedRow.Type ?? ""))) continue;

    const dateStr = typedRow["Completed Date"] || typedRow["Started Date"];
    const parsedDate = parseRevolutDate(dateStr);
    if (!parsedDate) {
      errors.push(`Row ${i}: Could not parse date "${dateStr}"`);
      continue;
    }

    const rawAmount = typedRow.Amount;
    if (!rawAmount) continue;

    const amount = normalizeAmount(rawAmount);
    if (isNaN(amount)) {
      errors.push(`Row ${i}: Could not parse amount "${rawAmount}"`);
      continue;
    }

    const description = typedRow.Description || "Unknown";
    const currency = typedRow.Currency || "EUR";

    // Internal transfers (self-transfers + savings-vault mirrors) are filtered
    // downstream via user-configured keywords (see filterInternalTransfers), not
    // hardcoded here — so the parser works for any account.
    const dedupKey = `${parsedDate}|${description}|${amount}|${currency}`;

    transactions.push({
      id: occurrenceId(dedupKey, counts),
      date: parsedDate,
      description,
      amount: Math.abs(amount),
      type: amount < 0 ? "expense" : "income",
      currency,
      category: "Uncategorized",
      source: "revolut",
      categorySource: "auto",
      excluded: false,
    });
  }

  return { transactions, errors };
}
