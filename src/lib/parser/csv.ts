/** Splits one CSV line into trimmed fields, honouring quotes and RFC 4180 escaped quotes (""). */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Non-blank lines of a CSV file. */
export function csvLines(content: string): string[] {
  return content.split("\n").filter((l) => l.trim());
}

/**
 * Parses an amount as banks write it: "-12.50", "1,234.56", "1.234,56", "12,50".
 * Whichever separator comes last is the decimal point; a lone comma followed by
 * groups of three digits ("1,234") is a thousands separator.
 */
export function parseMoney(raw: string): number {
  let t = raw.replace(/[^\d.,-]/g, "");
  if (!t) return NaN;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    t = lastDot > lastComma ? t.replace(/,/g, "") : t.replace(/\./g, "").replace(",", ".");
  } else if (lastComma > -1) {
    t = /^-?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  }
  return parseFloat(t);
}
