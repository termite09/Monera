import { describe, it, expect } from "vitest";
import { landingByBudget } from "@/lib/forecast";

describe("landingByBudget", () => {
  it("flags a budget heading over even when the other has room", () => {
    const r = landingByBudget(
      { Needs: 1200, Wants: 720 },
      { Needs: 989.7, Wants: 237.92 },
      { Needs: 129, Wants: 0 },
      { Needs: 120, Wants: 160 },
    );
    expect(r.Needs).toBe(-38.7);
    expect(r.Wants).toBe(322.08);
  });
});
