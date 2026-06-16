import { DriveFile } from "@/types";
import { getCached, setCached, invalidateCache } from "@/lib/cache";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

async function driveRequest(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (response.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    return driveRequest(url, accessToken, options);
  }

  return response;
}

export async function listFiles(
  accessToken: string,
  query: string
): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: query,
    fields: "files(id,name,mimeType,createdTime,size)",
    orderBy: "createdTime desc",
  });

  const res = await driveRequest(`${DRIVE_API}/files?${params}`, accessToken);
  if (!res.ok) throw new Error(`Drive listFiles failed: ${res.statusText}`);

  const data = await res.json();
  return data.files ?? [];
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

  const boundary = "monera_boundary";
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

export async function uploadCSV(
  accessToken: string,
  name: string,
  parentId: string,
  content: string
): Promise<string> {
  return createFile(accessToken, name, parentId, content, "text/csv");
}
