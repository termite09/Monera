import type { StatementCoverage } from "@/types";
import type { DateRange } from "@/lib/periods";
import { parseDateStr, toDateStr } from "@/lib/periods";

export interface CoverageSummary {
  /** First and last day any statement covers. */
  from: string;
  to: string;
  /** Stretches no statement covers although Revolut's balance changed across them. */
  gaps: DateRange[];
}

const shift = (date: string, days: number) => {
  const d = parseDateStr(date);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
};
const sameMoney = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);

/**
 * What the statements cover for one currency, and where something is missing.
 * Statements whose dates don't meet are compared by balance: if Revolut's
 * balance at the end of the earlier one equals the start of the later one,
 * nothing happened in between and there's no gap. So a quiet few days is never
 * reported as missing.
 */
export function statementCoverage(coverage: StatementCoverage[], currency: string): CoverageSummary | null {
  const ranges = coverage.filter((c) => c.currency === currency).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  if (ranges.length === 0) return null;

  const gaps: DateRange[] = [];
  let to = ranges[0].to;
  let closing = ranges[0].closingBalance;
  for (const next of ranges.slice(1)) {
    if (next.from > to && !sameMoney(closing, next.openingBalance)) {
      // The days strictly between; when the two statements are on consecutive
      // days, the missing payments settled on one of those two days.
      const from = shift(to, 1);
      const until = shift(next.from, -1);
      gaps.push(from <= until ? { from, to: until } : { from: to, to: next.from });
    }
    if (next.to >= to) {
      to = next.to;
      closing = next.closingBalance;
    }
  }
  return { from: ranges[0].from, to, gaps };
}
