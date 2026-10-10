import { DriveFile } from "@/types";
import { getCached, setCached, invalidateCache } from "@/lib/cache";
import { DriveAuthError } from "@/lib/errors";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 4;
// Server errors are usually brief; one retry covers a blip without making a
// real outage take long to show.
const SERVER_ERROR_RETRIES = 1;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Drive signals rate limiting with 429, or with 403 and a "...RateLimitExceeded" reason. */
async function isRateLimited(response: Response): Promise<boolean> {
  if (response.status === 429) return true;
  if (response.status !== 403) return false;
  const body = await response.clone().json().catch(() => null);
  return /ratelimitexceeded/i.test(JSON.stringify(body?.error?.errors ?? []));
}

async function driveRequest(
  url: string,
  accessToken: string,
  options: RequestInit = {},
  attempt = 0
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) throw new DriveAuthError();

  // Back off on rate limiting, but cap retries so a sustained limit can't spin
  // forever — surface the error after a few exponential attempts instead.
  if (attempt < MAX_RETRIES && (await isRateLimited(response))) {
    await wait(1000 * 2 ** attempt); // 1s, 2s, 4s, 8s
    return driveRequest(url, accessToken, options, attempt + 1);
  }

  // A POST that failed with a server error may still have created the file or
  // folder, so only requests that are safe to repeat are retried.
  const repeatable = (options.method ?? "GET") !== "POST";
  if (response.status >= 500 && repeatable && attempt < SERVER_ERROR_RETRIES) {
    await wait(1000);
    return driveRequest(url, accessToken, options, attempt + 1);
  }

  return response;
}

/** Every file matching a Drive query, newest first, following pagination. */
export async function listFiles(
  accessToken: string,
  query: string
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: query,
      fields: "nextPageToken,files(id,name,mimeType,createdTime,size)",
      orderBy: "createdTime desc",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await driveRequest(`${DRIVE_API}/files?${params}`, accessToken);
    if (!res.ok) throw new Error(`Drive listFiles failed: ${res.statusText}`);
    const data: { files?: DriveFile[]; nextPageToken?: string } = await res.json();
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

export async function createFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<string> {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const res = await driveRequest(`${DRIVE_API}/files`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) throw new Error(`Drive createFolder failed: ${res.statusText}`);
  const data = await res.json();
  return data.id;
}

export async function readFile(accessToken: string, fileId: string): Promise<string> {
  const cached = getCached<string>(`file:${fileId}`);
  if (cached !== null) return cached;

  const res = await driveRequest(
    `${DRIVE_API}/files/${fileId}?alt=media`,
    accessToken
  );
  if (!res.ok) throw new Error(`Drive readFile failed: ${res.statusText}`);
  const content = await res.text();
  setCached(`file:${fileId}`, content);
  return content;
}

export async function writeFile(
  accessToken: string,
  fileId: string,
  content: string
): Promise<void> {
  const res = await driveRequest(
    `${UPLOAD_API}/files/${fileId}?uploadType=media`,
    accessToken,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: content,
    }
  );
  if (!res.ok) throw new Error(`Drive writeFile failed: ${res.statusText}`);
  invalidateCache(`file:${fileId}`);
}

export async function createFile(
  accessToken: string,
  name: string,
  parentId: string,
  content: string,
  mimeType = "application/json"
): Promise<string> {
  const metadata = { name, parents: [parentId], mimeType };

  const boundary = `monera_${crypto.randomUUID().replace(/-/g, "")}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n");

  const res = await driveRequest(
    `${UPLOAD_API}/files?uploadType=multipart`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );

  if (!res.ok) throw new Error(`Drive createFile failed: ${res.statusText}`);
  const data = await res.json();
  return data.id;
}

export async function deleteFile(accessToken: string, fileId: string): Promise<void> {
  const res = await driveRequest(`${DRIVE_API}/files/${fileId}`, accessToken, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) throw new Error(`Drive deleteFile failed: ${res.statusText}`);
  invalidateCache(`file:${fileId}`);
}
