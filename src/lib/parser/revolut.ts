import { Transaction, ParsedCSV, StatementCoverage } from "@/types";
import { parseStatementDate } from "./dates";
import { splitCsvLine, csvLines, parseMoney } from "./csv";
import { occurrenceId } from "@/lib/utils";

// Only these transaction types are imported, plus every kind of refund ("Card
// Refund", "Rev Payment Refund"…). Everything else (Topup, Interest, Exchange…)
// is ignored. Normalized by uppercasing and stripping spaces/underscores so
// both "Card payment" and "CARD_PAYMENT" match.
const ALLOWED_TYPES = new Set([
  "CARDPAYMENT",
  "CARDREFUND",
  "CHARGE",
  "REVPAYMENT",
  "TRANSFER",
]);

// States meaning "this never actually happened": not imported, but they cancel
// a pending copy from an earlier export. Everything else (COMPLETED, PENDING)
// is imported since settlement can take days and we don't want to wait on it.
const EXCLUDED_STATES = new Set(["DECLINED", "FAILED", "REVERTED"]);

const cents = (n: number) => Math.round(n * 100) / 100;

function normalizeType(type: string): string {
  return type.toUpperCase().replace(/[\s_]/g, "");
}

/** True when the header row is a Revolut export's. */
export function isRevolutHeader(headers: string[]): boolean {
  const h = headers.map((x) => x.toLowerCase());
  return h.includes("type") && h.includes("product") && h.includes("state") && h.some((x) => x.includes("completed date"));
}

interface Row {
  i: number;
  state: string;
  type: string;
  product: string;
  /** "Started Date" exactly as exported, to the second. */
  started: string;
  date: string;
  description: string;
  listed: number;
  amount: number;
  currency: string;
  cancelled: boolean;
}

export function parseRevolutCSV(csvContent: string): ParsedCSV {
  const lines = csvLines(csvContent);
  if (lines.length < 2) {
    return { transactions: [], errors: ["Empty or invalid CSV file"] };
  }

  const headers = splitCsvLine(lines[0]);
  const col = (name: string) => headers.indexOf(name);
  const typeIdx = col("Type");
  const productIdx = col("Product");
  const stateIdx = col("State");
  const dateIdx = col("Started Date");
  const descIdx = col("Description");
  const amountIdx = col("Amount");
  const feeIdx = col("Fee");
  const currencyIdx = col("Currency");
  const completedIdx = col("Completed Date");
  const balanceIdx = col("Balance");

  const errors: string[] = [];
  const rows: Row[] = [];
  // Every settled row of the main account moves its balance, top-ups included,
  // so coverage is read from all of them, not just the ones imported.
  const coverage = new Map<string, StatementCoverage>();

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    if (values.length < headers.length) continue;
    // Quote characters are dropped from values, as they always have been: ids are
    // built from the description, so keeping them would orphan saved overrides.
    const field = (idx: number) => (idx >= 0 ? (values[idx] ?? "").replace(/"/g, "") : "");

    const state = field(stateIdx).toUpperCase();
    const product = field(productIdx);
    const completed = parseStatementDate(field(completedIdx));
    const balance = parseMoney(field(balanceIdx));
    if (state === "COMPLETED" && (product === "Current" || productIdx < 0) && completed && !isNaN(balance)) {
      const currency = field(currencyIdx) || "EUR";
      const moved = (parseMoney(field(amountIdx)) || 0) - (parseMoney(field(feeIdx)) || 0);
      const seen = coverage.get(currency);
      if (!seen) {
        coverage.set(currency, { currency, from: completed, to: completed, openingBalance: cents(balance - moved), closingBalance: balance });
      } else {
        if (completed < seen.from) seen.from = completed;
        if (completed > seen.to) seen.to = completed;
        seen.closingBalance = balance; // rows are listed in the order they settled
      }
    }

    const type = normalizeType(field(typeIdx));
    if (!ALLOWED_TYPES.has(type) && !type.endsWith("REFUND")) continue;
    // Declined, failed or reverted: never happened, but kept to cancel a pending
    // copy of the same payment imported from an earlier export.
    const cancelled = EXCLUDED_STATES.has(state);

    const started = field(dateIdx).trim();
    const date = parseStatementDate(started);
    if (!date) {
      if (!cancelled) errors.push(`Row ${i}: Could not parse date "${started}"`);
      continue;
    }

    const rawAmount = field(amountIdx);
    if (!rawAmount) continue;
    const listed = parseMoney(rawAmount);
    if (isNaN(listed)) {
      if (!cancelled) errors.push(`Row ${i}: Could not parse amount "${rawAmount}"`);
      continue;
    }
    // A fee is a cost on top of the amount: the Metal plan fee is "0.00" with
    // 18.99 in the Fee column.
    const fee = parseMoney(field(feeIdx));
    const amount = Math.round((listed - (isNaN(fee) ? 0 : fee)) * 100) / 100;
    if (amount === 0) continue;

    rows.push({
      i, state, type, product, started, date,
      description: field(descIdx) || "Unknown", listed, amount, currency: field(currencyIdx) || "EUR", cancelled,
    });
  }

  // A move between the main account and a savings vault appears twice: once on
  // each side, at the same second, for opposite amounts. Found by that pairing,
  // not by the vault's name, so any vault works. Money into a vault counts as
  // Savings and its mirror is dropped; money back out is your own money either
  // way, so both sides are dropped.
  const dropped = new Set<Row>();
  const savingsMoves = new Set<Row>();
  for (const vault of rows) {
    if (vault.cancelled || vault.type !== "TRANSFER" || !vault.product || vault.product === "Current") continue;
    const main = rows.find((m) =>
      !m.cancelled && m.type === "TRANSFER" && m.product === "Current" && m.started === vault.started &&
      m.currency === vault.currency && m.amount === -vault.amount && !dropped.has(m) && !savingsMoves.has(m)
    );
    if (!main) continue;
    dropped.add(vault);
    if (main.amount < 0) savingsMoves.add(main);
    else dropped.add(main);
  }

  const transactions: Transaction[] = [];
  const cancelled: string[] = [];
  // Counts identical keys within this file so repeat purchases stay distinct.
  const counts = new Map<string, number>();
  const matchCounts = new Map<string, number>();

  for (const r of rows) {
    if (dropped.has(r)) continue;
    // One payment across overlapping exports: its start time, account, currency
    // and direction. Not its amount or name, which can change between a pending
    // row and the settled one (a fuel pre-authorisation, a renamed shop).
    const matchKey = occurrenceId(`${r.started}|${r.product}|${r.currency}|${r.amount < 0 ? "out" : "in"}`, matchCounts);
    if (r.cancelled) {
      cancelled.push(matchKey);
      continue;
    }
    // The id keeps its original recipe (listed amount included), so category
    // changes and leave-outs already saved against it still apply.
    const dedupKey = `${r.date}|${r.description}|${r.listed}|${r.currency}`;
    transactions.push({
      id: occurrenceId(dedupKey, counts),
      date: r.date,
      description: r.description,
      amount: Math.abs(r.amount),
      type: r.amount < 0 ? "expense" : "income",
      currency: r.currency,
      category: "Uncategorized",
      source: "statement",
      categorySource: "auto",
      excluded: false,
      matchKey,
      ...(r.state === "PENDING" && { pending: true }),
      ...(r.type.endsWith("REFUND") && r.amount > 0 && { refund: true }),
      ...(savingsMoves.has(r) && { savingsMove: true }),
    });
  }

  return { transactions, errors, cancelled, coverage: [...coverage.values()] };
}
