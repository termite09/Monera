import { listFiles, createFolder, createFile, readFile, writeFile } from "./drive";
import { DEFAULT_SETTINGS, DRIVE_ROOT_FOLDER, STATEMENTS_FOLDER, APP_DATA_FOLDER, DRIVE_FILES } from "@/config/constants";
import type { DriveFile } from "@/types";

export interface DriveStructure {
  rootId: string;
  statementsFolderId: string;
  appDataId: string;
  fileIds: Record<keyof typeof DRIVE_FILES, string>;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

const INITIAL_CONTENT: Record<keyof typeof DRIVE_FILES, string> = {
  manualTransactions: "[]",
  categoryOverrides: "{}",
  settings: JSON.stringify(DEFAULT_SETTINGS, null, 2),
  categoryRules: "[]",
  excludedTransactions: "[]",
  parseCache: "{}",
};

/**
 * Finds (or creates) the Monera folder, its two subfolders and the app-data
 * JSON files. Three list requests on an existing account: the root folder, its
 * subfolders, and the files in app-data.
 */
export async function ensureDriveStructure(accessToken: string): Promise<DriveStructure> {
  // listFiles is ordered by createdTime desc, so [0] is the newest match — the one
  // the app has consistently read/written, where the user's data lives.
  const roots = await listFiles(accessToken, `name='${DRIVE_ROOT_FOLDER}' and mimeType='${FOLDER_MIME}' and trashed=false`);
  const rootId = roots[0]?.id ?? (await createFolder(accessToken, DRIVE_ROOT_FOLDER));

  const subfolders = await listFiles(accessToken, `'${rootId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`);
  const findOrCreate = (name: string) =>
    subfolders.find((f) => f.name === name)?.id ?? createFolder(accessToken, name, rootId);
  const [statementsFolderId, appDataId] = await Promise.all([findOrCreate(STATEMENTS_FOLDER), findOrCreate(APP_DATA_FOLDER)]);

  const existing = await listFiles(accessToken, `'${appDataId}' in parents and trashed=false`);
  const keys = Object.keys(DRIVE_FILES) as (keyof typeof DRIVE_FILES)[];
  const ids = await Promise.all(
    keys.map((key) =>
      existing.find((f) => f.name === DRIVE_FILES[key])?.id ??
      createFile(accessToken, DRIVE_FILES[key], appDataId, INITIAL_CONTENT[key])
    )
  );

  return {
    rootId,
    statementsFolderId,
    appDataId,
    fileIds: Object.fromEntries(keys.map((key, i) => [key, ids[i]])) as DriveStructure["fileIds"],
  };
}

/** The statement CSVs the user has added, newest first. */
export function listStatementFiles(accessToken: string, structure: DriveStructure): Promise<DriveFile[]> {
  return listFiles(accessToken, `'${structure.statementsFolderId}' in parents and mimeType='text/csv' and trashed=false`);
}

export async function readAppFile<T>(accessToken: string, fileId: string, fallback?: T): Promise<T> {
  const content = await readFile(accessToken, fileId);
  try {
    return JSON.parse(content) as T;
  } catch {
    if (fallback !== undefined) {
      console.error(`readAppFile: malformed JSON in file ${fileId} — using fallback`);
      return fallback;
    }
    throw new Error(`readAppFile: malformed JSON in file ${fileId}`);
  }
}

export async function writeAppFile(accessToken: string, fileId: string, data: unknown): Promise<void> {
  await writeFile(accessToken, fileId, JSON.stringify(data, null, 2));
}
