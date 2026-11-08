import { describe, it, expect } from "vitest";
import { fromCache } from "@/hooks/useTransactions";

describe("parse cache entries", () => {
  it("re-reads the statement when an entry has an old or broken shape, instead of failing to load", () => {
    expect(fromCache(undefined)).toBeNull();
    expect(fromCache([{ id: "1" }])).toBeNull(); // an older version stored a bare list
    expect(fromCache({ transactions: "nope" })).toBeNull();
  });

  it("uses a good entry, filling anything missing with nothing", () => {
    expect(fromCache({ transactions: [] })).toEqual({ transactions: [], cancelled: [], coverage: [] });
  });
});
