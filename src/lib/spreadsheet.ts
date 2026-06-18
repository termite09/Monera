/** Minimal shape of a browser File — kept narrow so the converter is testable. */
export interface FileLike {
  name: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const SPREADSHEET_EXT = /\.(xlsx|xls)$/i;

export function isSpreadsheet(filename: string): boolean {
  return SPREADSHEET_EXT.test(filename);
}

/** What we store in Drive — always .csv so the rest of the pipeline is unchanged. */
export function csvFileName(filename: string): string {
  return SPREADSHEET_EXT.test(filename) ? filename.replace(SPREADSHEET_EXT, ".csv") : filename;
}

/**
 * Returns CSV text for an uploaded statement. CSV files pass straight through;
 * XLSX/XLS files are converted to CSV from their first sheet. SheetJS is loaded
 * lazily (only when a spreadsheet is actually uploaded) to keep it out of the
 * main bundle.
 */
export async function readSpreadsheetAsCsv(file: FileLike): Promise<string> {
  if (!isSpreadsheet(file.name)) {
    return file.text();
  }

  const XLSX = await import("xlsx");
  const data = new Uint8Array(await file.arrayBuffer());
  // cellDates keeps date cells as real Dates; we serialize the rows ourselves so
  // dates come out ISO (sheet_to_csv ignores dateNF and emits locale dates like
  // "6/10/24", which the parser rejects).
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return "";

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false });
  return rows.map((row) => row.map(serializeCell).join(",")).join("\n");
}

function serializeCell(value: unknown): string {
  if (value == null) return "";
  let str: string;
  if (value instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    str = `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())} ${p(value.getHours())}:${p(value.getMinutes())}:${p(value.getSeconds())}`;
  } else {
    str = String(value);
  }
  // Quote fields containing commas/quotes/newlines, escaping embedded quotes.
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
