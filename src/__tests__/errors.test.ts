import { describe, it, expect } from "vitest";
import { describeLoadError } from "@/components/layout/ErrorState";

describe("describeLoadError", () => {
  it("explains network failures as a connection problem", () => {
    expect(describeLoadError("Failed to fetch").kind).toBe("offline");
    expect(describeLoadError("anything", false).kind).toBe("offline");
  });
  it("explains expired sign-in", () => {
    expect(describeLoadError("Request failed with status 401").kind).toBe("auth");
  });
  it("explains Drive trouble", () => {
    expect(describeLoadError("Drive API error 503").kind).toBe("drive");
  });
  it("falls back to a calm generic message", () => {
    const d = describeLoadError("Unexpected token < in JSON");
    expect(d.title).toBe("Couldn't load your latest data");
  });
});
