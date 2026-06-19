import { describe, it, expect } from "vitest";
import { getRecurringInRange } from "@/lib/recurring";
import { periodKeysBetween } from "@/lib/utils";
import { RecurringPayment } from "@/types";

const bill = (over: Partial<RecurringPayment> = {}): RecurringPayment => ({
  id: "rent",
  name: "Rent",
  amount: 800,
  dayOfMonth: 1,
  category: "Needs",
  ...over,
});

describe("periodKeysBetween", () => {
  it("enumerates each month key in order (payday 1 = calendar months)", () => {
    expect(periodKeysBetween(new Date(2024, 0, 5), new Date(2024, 2, 20), 1)).toEqual([
      "2024-01",
      "2024-02",
      "2024-03",
    ]);
  });

  it("returns a single key when from and to share a period", () => {
    expect(periodKeysBetween(new Date(2024, 5, 2), new Date(2024, 5, 28), 1)).toEqual(["2024-06"]);
  });

  it("returns [] when from is after to", () => {
    expect(periodKeysBetween(new Date(2024, 5, 1), new Date(2024, 0, 1), 1)).toEqual([]);
  });
});

describe("getRecurringInRange", () => {
  it("yields one occurrence per month across a multi-month range", () => {
    const out = getRecurringInRange([bill()], new Date(2024, 0, 1), new Date(2024, 2, 31), 1);
    expect(out.map((t) => t.date)).toEqual(["2024-01-01", "2024-02-01", "2024-03-01"]);
  });

  it("clamps to the range, excluding occurrences outside it", () => {
    // Bill on the 20th; range Jan 10 – Feb 5 contains only Jan 20.
    const out = getRecurringInRange([bill({ dayOfMonth: 20 })], new Date(2024, 0, 10), new Date(2024, 1, 5), 1);
    expect(out.map((t) => t.date)).toEqual(["2024-01-20"]);
  });

  it("produces unique ids (de-duped)", () => {
    const out = getRecurringInRange([bill()], new Date(2024, 0, 1), new Date(2024, 11, 31), 1);
    expect(out).toHaveLength(12);
    expect(new Set(out.map((t) => t.id)).size).toBe(12);
  });

  it("returns nothing for an empty recurring list", () => {
    expect(getRecurringInRange([], new Date(2024, 0, 1), new Date(2024, 11, 31), 1)).toEqual([]);
  });
});
