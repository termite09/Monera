import { Transaction, ParsedCSV } from "@/types";
import { parseRevolutCSV, isRevolutHeader } from "./revolut";
import { parseStatementDate } from "./dates";
import { splitCsvLine, csvLines, parseMoney } from "./csv";
import { occurrenceId } from "@/lib/utils";

// Find the first header index whose name contains any of the candidates
function findCol(headers: string[], candidates: string[]): number {
  for (const cand of candidates) {
    const idx = headers.findIndex((h) => h.includes(cand));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Generic CSV parser for non-Revolut exports. Auto-detects the date,
 * description and amount columns (or separate debit/credit columns) by header
 * name. Negative amounts (or debit column) are expenses, positives are income.
 */
function parseGenericCSV(lines: string[]): ParsedCSV {
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());

  const dateIdx = findCol(headers, ["completed date", "transaction date", "date posted", "posted", "date"]);
  const descIdx = findCol(headers, ["description", "name", "details", "merchant", "payee", "narrative", "reference", "memo"]);
  const amountIdx = findCol(headers, ["amount", "value"]);
  const debitIdx = findCol(headers, ["debit", "paid out", "money out", "withdrawal"]);
  const creditIdx = findCol(headers, ["credit", "paid in", "money in", "deposit"]);
  const currencyIdx = findCol(headers, ["currency"]);

  const errors: string[] = [];
  if (dateIdx < 0) errors.push("Could not find a date column");
  if (amountIdx < 0 && debitIdx < 0 && creditIdx < 0) errors.push("Could not find an amount column");
  if (errors.length) return { transactions: [], errors };

  const transactions: Transaction[] = [];
  const counts = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    // Quote characters are dropped, as they always have been, so ids stay stable.
    const v = splitCsvLine(lines[i]).map((x) => x.replace(/"/g, ""));
    if (v.length < headers.length) continue;

    const date = parseStatementDate(v[dateIdx]);
    if (!date) continue;

    let amount = NaN;
    if (amountIdx >= 0 && v[amountIdx]) amount = parseMoney(v[amountIdx]);
    else if (debitIdx >= 0 && v[debitIdx]) amount = -Math.abs(parseMoney(v[debitIdx]));
    else if (creditIdx >= 0 && v[creditIdx]) amount = Math.abs(parseMoney(v[creditIdx]));
    if (isNaN(amount) || amount === 0) continue;

    const description = (descIdx >= 0 ? v[descIdx] : "") || "Unknown";
    const currency = (currencyIdx >= 0 ? v[currencyIdx] : "") || "EUR";
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

/**
 * Entry point: routes to the Revolut parser for Revolut exports, otherwise
 * falls back to the generic column-detecting parser.
 */
export function parseCSV(content: string): ParsedCSV {
  const lines = csvLines(content);
  if (lines.length < 2) return { transactions: [], errors: ["Empty or invalid CSV file"] };
  return isRevolutHeader(splitCsvLine(lines[0])) ? parseRevolutCSV(content) : parseGenericCSV(lines);
}
