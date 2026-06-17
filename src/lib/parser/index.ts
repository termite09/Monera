import { Transaction, ParsedCSV } from "@/types";
import { parseRevolutCSV } from "./revolut";
import { parseRevolutDate } from "./dates";
import { occurrenceId } from "@/lib/utils";

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseMoney(s: string): number {
  if (!s) return NaN;
  let t = s.replace(/[^\d.,-]/g, "").trim();
  if (t.includes(",") && t.includes(".")) t = t.replace(/,/g, ""); // 1,234.56 -> thousands comma
  else if (t.includes(",")) t = t.replace(",", "."); // 12,50 -> decimal comma
  return parseFloat(t);
}

// Find the first header index whose name contains any of the candidates
function findCol(headers: string[], candidates: string[]): number {
  for (const cand of candidates) {
    const idx = headers.findIndex((h) => h.includes(cand));
    if (idx >= 0) return idx;
  }
  return -1;
}

function isRevolut(headers: string[]): boolean {
  const h = headers.map((x) => x.toLowerCase());
  return h.includes("type") && h.includes("product") && h.includes("state") && h.some((x) => x.includes("completed date"));
}

/**
 * Generic CSV parser for non-Revolut exports. Auto-detects the date,
 * description and amount columns (or separate debit/credit columns) by header
 * name. Negative amounts (or debit column) are expenses, positives are income.
 */
export function parseGenericCSV(content: string): ParsedCSV {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { transactions: [], errors: ["Empty or invalid CSV file"] };

  const headers = splitLine(lines[0]).map((h) => h.replace(/"/g, "").trim().toLowerCase());

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
    const v = splitLine(lines[i]).map((x) => x.replace(/"/g, "").trim());
    if (v.length < headers.length) continue;

    const date = parseRevolutDate(v[dateIdx]);
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
      source: "revolut",
      categorySource: "auto",
    });
  }

  return { transactions, errors };
}

/**
 * Entry point: routes to the Revolut parser for Revolut exports, otherwise
 * falls back to the generic column-detecting parser.
 */
export function parseCSV(content: string): ParsedCSV {
  const firstLine = content.split("\n").find((l) => l.trim()) ?? "";
  const headers = splitLine(firstLine).map((h) => h.replace(/"/g, "").trim());
  return isRevolut(headers) ? parseRevolutCSV(content) : parseGenericCSV(content);
}
