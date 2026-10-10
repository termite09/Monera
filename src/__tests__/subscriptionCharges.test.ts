import { describe, it, expect } from "vitest";
import { nextChargeDate, monthlyCost, type Subscription } from "@/lib/insights";
import { expectedSubscriptionCharges } from "@/lib/safeToSpend";

const TODAY = new Date("2026-06-24T12:00:00");

function sub(name: string, lastDate: string, amount: number, everyMonths: 1 | 2 = 1): Subscription {
  return { key: name.toLowerCase(), name, amount, total: amount * 3, months: 3, lastDate, everyMonths };
}

describe("nextChargeDate", () => {
  it("skips a date that has already passed this month", () => {
    expect(nextChargeDate(sub("Netflix", "2026-05-10", 12.99), TODAY)).toBe("2026-07-10");
  });

  it("uses this month when the day hasn't come yet", () => {
    expect(nextChargeDate(sub("Spotify", "2026-05-28", 9.99), TODAY)).toBe("2026-06-28");
  });

  it("moves to next month when already charged this month", () => {
    expect(nextChargeDate(sub("Spotify", "2026-06-10", 9.99), TODAY)).toBe("2026-07-10");
  });

  it("clamps day 31 in a 30-day month", () => {
    expect(nextChargeDate(sub("X", "2026-05-31", 5), TODAY)).toBe("2026-06-30");
  });

  it("steps two months for a bi-monthly subscription", () => {
    expect(nextChargeDate(sub("Insurance", "2026-05-28", 60, 2), TODAY)).toBe("2026-07-28");
  });
});

describe("monthlyCost", () => {
  it("halves a bi-monthly charge", () => {
    expect(monthlyCost(sub("Insurance", "2026-05-28", 60, 2))).toBe(30);
    expect(monthlyCost(sub("Netflix", "2026-05-28", 12, 1))).toBe(12);
  });
});

describe("expectedSubscriptionCharges", () => {
  it("keeps only charges up to the given day, with their last charge date", () => {
    const result = expectedSubscriptionCharges(
      [sub("Spotify", "2026-05-28", 9.99), sub("Netflix", "2026-05-10", 12.99)],
      TODAY,
      "2026-07-01"
    );
    expect(result).toEqual([{ name: "Spotify", amount: 9.99, date: "2026-06-28", lastChargeDate: "2026-05-28" }]);
  });

  it("returns nothing when there are no subscriptions", () => {
    expect(expectedSubscriptionCharges([], TODAY, "2026-07-24")).toEqual([]);
  });
});
