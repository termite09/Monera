import type { SafeToSpendBillItem } from "@/lib/safeToSpend";
import type { Subscription } from "@/lib/reports";
import { toDateStr } from "@/lib/utils";

export interface UpcomingCharge {
  name: string;
  amount: number;
  date: string;            // YYYY-MM-DD
  isEstimated: boolean;
  lastChargeDate?: string; // only when isEstimated is true
}

/** Clamp day to the last day of the given month (month is 1-indexed). */
function clampedDateStr(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const clamped = Math.min(day, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

/**
 * Estimate the next charge date for a detected subscription.
 * Logic:
 *   - If lastDate is in the current calendar month → next is same day next month.
 *   - Otherwise: if same day this month hasn't passed yet → return it.
 *                else → return same day next month.
 */
function estimateNextDate(lastDate: string, today: Date): string {
  const lastYear = parseInt(lastDate.slice(0, 4), 10);
  const lastMonth = parseInt(lastDate.slice(5, 7), 10); // 1-indexed
  const day = parseInt(lastDate.slice(8, 10), 10);

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-indexed
  const todayStr = toDateStr(today);

  // Already charged this calendar month → next charge is next month
  if (lastYear === todayYear && lastMonth === todayMonth) {
    let nextYear = todayYear;
    let nextMonth = todayMonth + 1;
    if (nextMonth > 12) { nextMonth = 1; nextYear++; }
    return clampedDateStr(nextYear, nextMonth, day);
  }

  // Not charged this month yet — check if this month's date is still upcoming
  const thisMonthCandidate = clampedDateStr(todayYear, todayMonth, day);
  if (thisMonthCandidate > todayStr) {
    return thisMonthCandidate;
  }

  // This month's date has already passed → next month
  let nextYear = todayYear;
  let nextMonth = todayMonth + 1;
  if (nextMonth > 12) { nextMonth = 1; nextYear++; }
  return clampedDateStr(nextYear, nextMonth, day);
}

/**
 * Returns the merged, sorted list of upcoming charges within the next `windowDays`
 * days (default 14). Manual recurring bills take priority over detected
 * subscriptions when the same name appears in both sources.
 *
 * @param billItems   - Upcoming recurring bill transactions (source "recurring", date > today)
 * @param subscriptions - Detected subscriptions with excludedSubscriptions already filtered out
 * @param today       - Injected so the result is deterministic in tests
 * @param windowDays  - How many days ahead to look (default 14)
 */
export function getUpcomingCharges(
  billItems: SafeToSpendBillItem[],
  subscriptions: Subscription[],
  today: Date,
  windowDays = 14
): UpcomingCharge[] {
  const todayStr = toDateStr(today);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + windowDays);
  const windowEndStr = toDateStr(windowEnd);

  // Manual bills: already have exact dates, keep those within the window
  const manualCharges: UpcomingCharge[] = billItems
    .filter((b) => b.date > todayStr && b.date <= windowEndStr)
    .map((b) => ({ name: b.name, amount: b.amount, date: b.date, isEstimated: false }));

  const manualNames = new Set(manualCharges.map((c) => c.name.toLowerCase()));

  // Detected subscriptions: estimate next date, skip if manual bill covers it
  const detectedCharges: UpcomingCharge[] = subscriptions
    .map((s) => ({ s, nextDate: estimateNextDate(s.lastDate, today) }))
    .filter(({ nextDate }) => nextDate > todayStr)
    .filter(({ s }) => !manualNames.has(s.name.toLowerCase()))
    .map(({ s, nextDate }) => ({
      name: s.name,
      amount: s.amount,
      date: nextDate,
      isEstimated: true,
      lastChargeDate: s.lastDate,
    }));

  return [...manualCharges, ...detectedCharges].sort((a, b) => a.date.localeCompare(b.date));
}
