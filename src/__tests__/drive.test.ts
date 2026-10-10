import { describe, it, expect, vi, afterEach } from "vitest";
import { createFile, listFiles, writeFile } from "@/lib/google/drive";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const ok = (body: unknown = {}) => new Response(JSON.stringify(body));
const status = (code: number, body: unknown = {}) => new Response(JSON.stringify(body), { status: code });
const rateLimited403 = () => status(403, { error: { errors: [{ reason: "userRateLimitExceeded" }] } });

/** Runs a Drive call to completion, skipping the backoff waits. */
async function settle<T>(call: Promise<T>): Promise<T> {
  vi.useFakeTimers();
  const settled = call.then((value) => ({ value }), (error: unknown) => ({ error }));
  await vi.runAllTimersAsync();
  const result = await settled;
  if ("error" in result) throw result.error;
  return result.value;
}

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

describe("Drive retries", () => {
  it("backs off and retries when Drive rate-limits with a 403", async () => {
    const responses = [rateLimited403(), ok({ files: [{ id: "a" }] })];
    const fetchMock = vi.fn(async () => responses.shift()!);
    vi.stubGlobal("fetch", fetchMock);

    const files = await settle(listFiles("token", "trashed=false"));

    expect(files.map((f) => f.id)).toEqual(["a"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry a 403 that isn't rate limiting", async () => {
    const fetchMock = vi.fn(async () => status(403, { error: { errors: [{ reason: "insufficientPermissions" }] } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(settle(listFiles("token", "trashed=false"))).rejects.toThrow("listFiles failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a save once after a server error", async () => {
    const responses = [status(503), ok()];
    const fetchMock = vi.fn(async () => responses.shift()!);
    vi.stubGlobal("fetch", fetchMock);

    await settle(writeFile("token", "file1", "{}"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry when the server keeps failing", async () => {
    const fetchMock = vi.fn(async () => status(500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(settle(writeFile("token", "file1", "{}"))).rejects.toThrow("writeFile failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never repeats a create after a server error, since it may have gone through", async () => {
    const fetchMock = vi.fn(async () => status(500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(settle(createFile("token", "a.csv", "folder", "x", "text/csv"))).rejects.toThrow("createFile failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
