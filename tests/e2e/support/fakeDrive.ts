import type { Page, Route } from "@playwright/test";

const FOLDER = "application/vnd.google-apps.folder";
const APP_FILES = {
  manualTransactions: "manual-transactions.json",
  categoryOverrides: "category-overrides.json",
  settings: "settings.json",
  categoryRules: "category-rules.json",
  excludedTransactions: "excluded-transactions.json",
  parseCache: "parse-cache.json",
} as const;
type AppFile = keyof typeof APP_FILES;

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  content: string;
  createdTime: string;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

/**
 * An in-memory Google Drive that answers the app's REST calls inside the
 * browser. Supports exactly what Monera uses: files.list (with pagination),
 * download, folder create, multipart upload, media update and delete.
 */
export class FakeDrive {
  private items = new Map<string, DriveItem>();
  private seq = 0;
  /** Answer every request with 401, as Drive does for an expired token. */
  unauthorized = false;
  /** Small on purpose, so every listing exercises the app's pagination. */
  maxPageSize = 3;
  /** Names of files whose download fails with a server error, as during a Drive outage. */
  failingDownloads = new Set<string>();

  async install(page: Page): Promise<void> {
    await page.route(/^https:\/\/www\.googleapis\.com\//, (route) => this.handle(route));
  }

  // ── Seeding and inspection ────────────────────────────────────────────

  add(name: string, mimeType: string, parent: string | null, content = ""): string {
    const id = `file${++this.seq}`;
    // Strictly increasing times keep "newest first" ordering predictable.
    const createdTime = new Date(Date.UTC(2026, 0, 1, 0, 0, this.seq)).toISOString();
    this.items.set(id, { id, name, mimeType, parents: parent ? [parent] : [], content, createdTime });
    return id;
  }

  /** A Monera folder as the app would have left it, with the given app data and statements. */
  seed(data: {
    settings: object;
    rules?: object;
    manualTransactions?: object[];
    categoryOverrides?: Record<string, string>;
    excludedTransactions?: string[];
    statements?: { name: string; csv: string }[];
  }): void {
    const root = this.add("Monera", FOLDER, null);
    const statementsFolder = this.add("revolut-exports", FOLDER, root);
    const appData = this.add("app-data", FOLDER, root);
    const contents: Record<AppFile, unknown> = {
      manualTransactions: data.manualTransactions ?? [],
      categoryOverrides: data.categoryOverrides ?? {},
      settings: data.settings,
      categoryRules: data.rules ?? [],
      excludedTransactions: data.excludedTransactions ?? [],
      parseCache: {},
    };
    for (const key of Object.keys(APP_FILES) as AppFile[]) {
      this.add(APP_FILES[key], "application/json", appData, JSON.stringify(contents[key]));
    }
    for (const s of data.statements ?? []) this.add(s.name, "text/csv", statementsFolder, s.csv);
  }

  /** Empties the Drive, as if the user deleted the Monera folder. New items get new ids. */
  clear(): void {
    this.items.clear();
  }

  /** Parsed contents of one of the app-data JSON files. */
  appFile<T = unknown>(key: AppFile): T {
    const item = [...this.items.values()].find((i) => i.name === APP_FILES[key]);
    if (!item) throw new Error(`No ${APP_FILES[key]} in the fake Drive`);
    return JSON.parse(item.content) as T;
  }

  folders(): string[] {
    return [...this.items.values()].filter((i) => i.mimeType === FOLDER).map((i) => i.name);
  }

  statements(): { name: string; content: string }[] {
    return [...this.items.values()].filter((i) => i.mimeType === "text/csv").map(({ name, content }) => ({ name, content }));
  }

  // ── Request handling ──────────────────────────────────────────────────

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const method = request.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (this.unauthorized) return this.json(route, 401, { error: { code: 401, message: "Invalid Credentials" } });

    const url = new URL(request.url());
    const fileId = url.pathname.match(/\/files\/([^/]+)$/)?.[1];
    const isUpload = url.pathname.startsWith("/upload/");

    if (method === "GET" && !fileId) return this.list(route, url);
    if (method === "GET" && fileId) {
      const item = this.items.get(fileId);
      if (!item) return this.json(route, 404, { error: { code: 404, message: "File not found" } });
      if (this.failingDownloads.has(item.name)) return this.json(route, 500, { error: { code: 500, message: "Backend Error" } });
      return route.fulfill({ status: 200, headers: CORS, contentType: item.mimeType, body: item.content });
    }
    if (method === "POST" && isUpload) {
      const { metadata, content } = parseMultipart(request.postData() ?? "", request.headers()["content-type"] ?? "");
      const id = this.add(metadata.name, metadata.mimeType, metadata.parents?.[0] ?? null, content);
      return this.json(route, 200, { id });
    }
    if (method === "POST") {
      const metadata = JSON.parse(request.postData() ?? "{}");
      const id = this.add(metadata.name, metadata.mimeType, metadata.parents?.[0] ?? null);
      return this.json(route, 200, { id });
    }
    if (method === "PATCH" && fileId) {
      const item = this.items.get(fileId);
      if (!item) return this.json(route, 404, { error: { code: 404, message: "File not found" } });
      item.content = request.postData() ?? "";
      return this.json(route, 200, { id: fileId });
    }
    if (method === "DELETE" && fileId) {
      this.items.delete(fileId);
      return route.fulfill({ status: 204, headers: CORS });
    }
    return this.json(route, 400, { error: { code: 400, message: `Unsupported ${method} ${url.pathname}` } });
  }

  private list(route: Route, url: URL) {
    const q = url.searchParams.get("q") ?? "";
    const name = q.match(/name='([^']*)'/)?.[1];
    const parent = q.match(/'([^']*)' in parents/)?.[1];
    const mimeType = q.match(/mimeType='([^']*)'/)?.[1];
    const matches = [...this.items.values()]
      .filter((i) => (name === undefined || i.name === name) && (!parent || i.parents.includes(parent)) && (!mimeType || i.mimeType === mimeType))
      .sort((a, b) => b.createdTime.localeCompare(a.createdTime));

    const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? 100), this.maxPageSize);
    const start = Number(url.searchParams.get("pageToken") ?? 0);
    const page = matches.slice(start, start + pageSize).map(({ id, name, mimeType, createdTime, content }) => ({
      id, name, mimeType, createdTime, size: String(content.length),
    }));
    const next = start + pageSize < matches.length ? String(start + pageSize) : undefined;
    return this.json(route, 200, { files: page, ...(next ? { nextPageToken: next } : {}) });
  }

  private json(route: Route, status: number, body: unknown) {
    return route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
  }
}

/** Splits a multipart/related upload into its JSON metadata and file content. */
function parseMultipart(body: string, contentType: string): { metadata: { name: string; mimeType: string; parents?: string[] }; content: string } {
  const boundary = contentType.match(/boundary=(.+)$/)?.[1];
  if (!boundary) throw new Error("Multipart upload without a boundary");
  const parts = body
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((part) => part.slice(part.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, ""));
  return { metadata: JSON.parse(parts[0]), content: parts[1] };
}
