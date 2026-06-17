import { describe, it, expect } from "vitest";
import { getMonthKey, getPeriodBounds, getMonthLabel, generateId, formatCurrency } from "@/lib/utils";

describe("getMonthKey", () => {
  it("returns YYYY-MM for payday=1", () => {
    expect(getMonthKey("2024-06-15")).toBe("2024-06");
  });

  it("date before payday belongs to previous month key", () => {
    // Payday is 24th: Jun 10 belongs to May's period (May 24 – Jun 23)
    expect(getMonthKey("2024-06-10", 24)).toBe("2024-05");
  });

  it("date on or after payday belongs to current month key", () => {
    expect(getMonthKey("2024-06-24", 24)).toBe("2024-06");
    expect(getMonthKey("2024-06-30", 24)).toBe("2024-06");
  });
});

describe("getPeriodBounds", () => {
  it("starts on payday and ends day before next payday", () => {
    const { start, end } = getPeriodBounds("2024-06", 24);
    expect(start.getDate()).toBe(24);
    expect(start.getMonth()).toBe(5); // June (0-indexed)
    // end should be July 23 23:59:59.999
    expect(end.getDate()).toBe(23);
    expect(end.getMonth()).toBe(6); // July
    expect(end.getMilliseconds()).toBe(999);
  });

  it("for payday=1 starts on the 1st", () => {
    const { start } = getPeriodBounds("2024-06", 1);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(5);
  });
});

describe("getMonthLabel", () => {
  it("returns long month name for payday=1", () => {
    expect(getMonthLabel("2024-06", 1)).toBe("June 2024");
  });

  it("returns date range for non-1 payday", () => {
    const label = getMonthLabel("2024-06", 24);
    expect(label).toContain("24");
    expect(label).toContain("Jun");
  });
});

describe("generateId", () => {
  it("produces consistent output", () => {
    expect(generateId("hello")).toBe(generateId("hello"));
  });

  it("produces different ids for different inputs", () => {
    expect(generateId("a")).not.toBe(generateId("b"));
  });
});

describe("formatCurrency", () => {
  it("formats with 2 decimal places", () => {
    expect(formatCurrency(1234.5)).toBe("€1,234.50");
  });

  it("uses provided currency symbol", () => {
    expect(formatCurrency(100, "$")).toBe("$100.00");
  });
});
