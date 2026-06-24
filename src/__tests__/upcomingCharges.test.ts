import { describe, it, expect } from "vitest";
import { getUpcomingCharges } from "@/lib/upcomingCharges";
import type { SafeToSpendBillItem } from "@/lib/safeToSpend";
import type { Subscription } from "@/lib/reports";

const TODAY = new Date("2026-06-24T12:00:00");

function bill(name: string, date: string, amount: number): SafeToSpendBillItem {
  return { name, date, amount };
}

function sub(name: string, lastDate: string, amount: number): Subscription {
  return { name, amount, total: amount * 3, months: 3, lastDate };
}

describe("getUpcomingCharges", () => {
  it("includes a manual bill due within the window", () => {
    const result = getUpcomingCharges([bill("Rent", "2026-06-28", 900)], [], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Rent", amount: 900, isEstimated: false, date: "2026-06-28" });
  });

  it("excludes a manual bill beyond the 14-day window", () => {
    const result = getUpcomingCharges([bill("Rent", "2026-07-10", 900)], [], TODAY);
    expect(result).toHaveLength(0);
  });

  it("estimates next date for a subscription charged last month", () => {
    // lastDate = May 10 → next expected = Jun 10, which has passed → Jul 10
    const result = getUpcomingCharges([], [sub("Netflix", "2026-05-10", 12.99)], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "Netflix",
      isEstimated: true,
      date: "2026-07-10",
      lastChargeDate: "2026-05-10",
    });
  });

  it("estimates next date as this month when not yet passed", () => {
    // lastDate = May 28 → next expected = Jun 28, which hasn't passed yet (today = Jun 24)
    const result = getUpcomingCharges([], [sub("Spotify", "2026-05-28", 9.99)], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-06-28");
  });

  it("estimates next month when subscription already charged this month", () => {
    // lastDate = Jun 10 (this month already) → next = Jul 10
    const result = getUpcomingCharges([], [sub("Spotify", "2026-06-10", 9.99)], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-07-10");
  });

  it("de-duplicates when same name appears in both sources — prefers manual bill", () => {
    const bills = [bill("Netflix", "2026-06-28", 12.99)];
    const subs = [sub("Netflix", "2026-05-28", 12.99)];
    const result = getUpcomingCharges(bills, subs, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].isEstimated).toBe(false);
  });

  it("sorts results by date ascending", () => {
    const result = getUpcomingCharges(
      [bill("Rent", "2026-07-01", 900)],
      [sub("Spotify", "2026-05-28", 9.99)],
      TODAY
    );
    expect(result[0].name).toBe("Spotify"); // Jun 28 before Jul 1
    expect(result[1].name).toBe("Rent");
  });

  it("clamps day 31 in a 30-day month", () => {
    // Sub charged on May 31 → next: Jun 30 (June has 30 days, today is Jun 24)
    const result = getUpcomingCharges([], [sub("X", "2026-05-31", 5)], TODAY);
    expect(result[0].date).toBe("2026-06-30");
  });

  it("returns empty array when nothing falls within the window", () => {
    const result = getUpcomingCharges([], [], TODAY);
    expect(result).toHaveLength(0);
  });
});
