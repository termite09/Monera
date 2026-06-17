import { listFiles, createFolder, createFile, readFile, writeFile } from "./drive";
import { DEFAULT_SETTINGS } from "@/config/constants";
import { DEFAULT_CATEGORY_RULES } from "@/config/categories";
import { DRIVE_ROOT_FOLDER, REVOLUT_EXPORTS_FOLDER, APP_DATA_FOLDER, DRIVE_FILES } from "@/config/constants";

export interface DriveStructure {
  rootId: string;
  revolutExportsId: string;
  appDataId: string;
  fileIds: {
    manualTransactions: string;
    categoryOverrides: string;
    settings: string;
    categoryRules: string;
    excludedTransactions: string;
    parseCache: string;
  };
}

export async function ensureDriveStructure(accessToken: string): Promise<DriveStructure> {
  // Find or create root Monera folder
  const rootFolders = await listFiles(
    accessToken,
    `name='${DRIVE_ROOT_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );

  let rootId: string;
  if (rootFolders.length > 0) {
    rootId = rootFolders[0].id;
  } else {
    rootId = await createFolder(accessToken, DRIVE_ROOT_FOLDER);
  }

  // Find or create revolut-exports folder
  const exportFolders = await listFiles(
    accessToken,
    `name='${REVOLUT_EXPORTS_FOLDER}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );

  let revolutExportsId: string;
  if (exportFolders.length > 0) {
    revolutExportsId = exportFolders[0].id;
  } else {
    revolutExportsId = await createFolder(accessToken, REVOLUT_EXPORTS_FOLDER, rootId);
  }

  // Find or create app-data folder
  const dataFolders = await listFiles(
    accessToken,
    `name='${APP_DATA_FOLDER}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );

  let appDataId: string;
  if (dataFolders.length > 0) {
    appDataId = dataFolders[0].id;
  } else {
    appDataId = await createFolder(accessToken, APP_DATA_FOLDER, rootId);
  }

  // Ensure JSON files exist. These are independent, so create/look them up in
  // parallel — on first run this roughly halves setup time vs. awaiting each.
  const [manualTransactions, categoryOverrides, settings, categoryRules, excludedTransactions, parseCache] =
    await Promise.all([
      ensureFile(accessToken, DRIVE_FILES.manualTransactions, appDataId, "[]"),
      ensureFile(accessToken, DRIVE_FILES.categoryOverrides, appDataId, "{}"),
      ensureFile(accessToken, DRIVE_FILES.settings, appDataId, JSON.stringify(DEFAULT_SETTINGS, null, 2)),
      ensureFile(accessToken, DRIVE_FILES.categoryRules, appDataId, JSON.stringify(DEFAULT_CATEGORY_RULES, null, 2)),
      ensureFile(accessToken, DRIVE_FILES.excludedTransactions, appDataId, "[]"),
      ensureFile(accessToken, DRIVE_FILES.parseCache, appDataId, "{}"),
    ]);

  return {
    rootId,
    revolutExportsId,
    appDataId,
    fileIds: { manualTransactions, categoryOverrides, settings, categoryRules, excludedTransactions, parseCache },
  };
}

async function ensureFile(
  accessToken: string,
  name: string,
  parentId: string,
  defaultContent: string
): Promise<string> {
  const files = await listFiles(
    accessToken,
    `name='${name}' and '${parentId}' in parents and trashed=false`
  );

  if (files.length > 0) return files[0].id;
  return createFile(accessToken, name, parentId, defaultContent);
}

export async function readAppFile<T>(accessToken: string, fileId: string): Promise<T> {
  const content = await readFile(accessToken, fileId);
  return JSON.parse(content) as T;
}

export async function writeAppFile(
  accessToken: string,
  fileId: string,
  data: unknown
): Promise<void> {
  await writeFile(accessToken, fileId, JSON.stringify(data, null, 2));
}
