import { Transaction, ParsedCSV } from "@/types";
import { parseStatementDate } from "./dates";
import { splitCsvLine, csvLines, parseMoney } from "./csv";
import { occurrenceId } from "@/lib/utils";

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

// States meaning "this never actually happened" — everything else (COMPLETED,
// PENDING) is imported since settlement can take days and we don't want to
// wait on it.
const EXCLUDED_STATES = new Set(["DECLINED", "FAILED", "REVERTED"]);

function normalizeType(type: string): string {
  return type.toUpperCase().replace(/[\s_]/g, "");
}

/** True when the header row is a Revolut export's. */
export function isRevolutHeader(headers: string[]): boolean {
  const h = headers.map((x) => x.toLowerCase());
  return h.includes("type") && h.includes("product") && h.includes("state") && h.some((x) => x.includes("completed date"));
}

export function parseRevolutCSV(csvContent: string): ParsedCSV {
  const lines = csvLines(csvContent);
  if (lines.length < 2) {
    return { transactions: [], errors: ["Empty or invalid CSV file"] };
  }

  const headers = splitCsvLine(lines[0]);
  const col = (name: string) => headers.indexOf(name);
  const typeIdx = col("Type");
  const stateIdx = col("State");
  const dateIdx = col("Started Date");
  const descIdx = col("Description");
  const amountIdx = col("Amount");
  const currencyIdx = col("Currency");

  const transactions: Transaction[] = [];
  const errors: string[] = [];
  // Counts identical dedup keys within this file so repeat purchases stay distinct.
  const counts = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    if (values.length < headers.length) continue;
    // Quote characters are dropped from values, as they always have been: ids are
    // built from the description, so keeping them would orphan saved overrides.
    const field = (idx: number) => (idx >= 0 ? (values[idx] ?? "").replace(/"/g, "") : "");

    if (EXCLUDED_STATES.has(field(stateIdx).toUpperCase())) continue;
    if (!ALLOWED_TYPES.has(normalizeType(field(typeIdx)))) continue;

    const dateStr = field(dateIdx);
    const date = parseStatementDate(dateStr);
    if (!date) {
      errors.push(`Row ${i}: Could not parse date "${dateStr}"`);
      continue;
    }

    const rawAmount = field(amountIdx);
    if (!rawAmount) continue;
    const amount = parseMoney(rawAmount);
    if (isNaN(amount)) {
      errors.push(`Row ${i}: Could not parse amount "${rawAmount}"`);
      continue;
    }

    const description = field(descIdx) || "Unknown";
    const currency = field(currencyIdx) || "EUR";

    // Internal transfers (self-transfers + savings-vault mirrors) are filtered
    // downstream via user-configured keywords (see filterInternalTransfers), not
    // hardcoded here — so the parser works for any account.
    const dedupKey = `${date}|${description}|${amount}|${currency}`;

    transactions.push({
      id: occurrenceId(dedupKey, counts),
      date,
      description,
      amount: Math.abs(amount),
      type: amount < 0 ? "expense" : "income",
      currency,
      category: "Uncategorized",
      source: "statement",
      categorySource: "auto",
      excluded: false,
    });
  }

  return { transactions, errors };
}
