import { createFile } from "@/lib/google/drive";
import type { DriveStructure } from "@/lib/google/folders";
import { DriveAuthError } from "@/lib/errors";
import { parseCSV } from "@/lib/parser";
import { readSpreadsheetAsCsv, csvFileName } from "@/lib/spreadsheet";
import { MAX_STATEMENT_BYTES } from "@/config/constants";

/** A statement read and checked locally, not yet saved to Drive. */
export interface StatementPreview {
  /** Always .csv — spreadsheets are converted so everything downstream stays CSV-only. */
  name: string;
  content: string;
  count: number;
  /** Rows that couldn't be read. */
  skipped: number;
  from: string | null;
  to: string | null;
}

/** An error whose message is already fit to show the user. */
export class StatementError extends Error {}

/** Reads a CSV or Excel statement and checks it has transactions. Throws StatementError with a readable message. */
export async function readStatement(file: File): Promise<StatementPreview> {
  if (file.size > MAX_STATEMENT_BYTES) {
    throw new StatementError(
      `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_STATEMENT_BYTES / 1024 / 1024} MB — try exporting a shorter date range.`
    );
  }
  const content = await readSpreadsheetAsCsv(file);
  const { transactions, errors } = parseCSV(content);
  if (transactions.length === 0) {
    throw new StatementError("We couldn't find any transactions in this file. Is it a statement export from your bank?");
  }
  const dates = transactions.map((t) => t.date).sort();
  return {
    name: csvFileName(file.name),
    content,
    count: transactions.length,
    skipped: errors.length,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  };
}

export async function saveStatement(accessToken: string, structure: DriveStructure, statement: StatementPreview): Promise<void> {
  await createFile(accessToken, statement.name, structure.statementsFolderId, statement.content, "text/csv");
}

/**
 * Plain-language message for anything that goes wrong reading, saving, listing
 * or removing statements. `fallback` covers errors with no better explanation.
 */
export function statementErrorMessage(
  err: unknown,
  fallback = "We couldn't add this file. Check it's a CSV or Excel export from your bank and try again."
): string {
  if (err instanceof StatementError) return err.message;
  if (err instanceof DriveAuthError) return "Your Google sign-in has expired. Sign out and back in, then try again.";
  const detail = err instanceof Error ? err.message : "";
  if (/network|fetch|failed to fetch/i.test(detail)) return "Couldn't reach Google Drive. Check your connection and try again.";
  return fallback;
}
