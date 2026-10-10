import { describe, it, expect, vi, afterEach } from "vitest";
import { listFiles } from "@/lib/google/drive";

afterEach(() => vi.unstubAllGlobals());

describe("listFiles", () => {
  it("follows nextPageToken until every page is read", async () => {
    const pages = [
      { files: [{ id: "a" }, { id: "b" }], nextPageToken: "p2" },
      { files: [{ id: "c" }] },
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(pages.shift())));
    vi.stubGlobal("fetch", fetchMock);

    const files = await listFiles("token", "trashed=false");

    expect(files.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = new URL(String((fetchMock.mock.calls[1] as unknown[])[0]));
    expect(secondUrl.searchParams.get("pageToken")).toBe("p2");
  });
});
