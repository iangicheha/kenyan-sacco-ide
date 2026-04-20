export type SheetPreviewRow = Record<string, string>;

export type StoredSheet = {
  headers: string[];
  rows: SheetPreviewRow[];
};

const uploadedFileStore = new Map<string, Map<string, Record<string, StoredSheet>>>();

function getTenantStore(tenantId: string): Map<string, Record<string, StoredSheet>> {
  const key = tenantId || "default";
  const existing = uploadedFileStore.get(key);
  if (existing) return existing;
  const created = new Map<string, Record<string, StoredSheet>>();
  uploadedFileStore.set(key, created);
  return created;
}

export function setUploadedFileSheets(tenantId: string, fileName: string, sheets: Record<string, StoredSheet>): void {
  getTenantStore(tenantId).set(fileName, sheets);
}

export function getUploadedSheet(tenantId: string, fileName: string, sheetName: string): StoredSheet | null {
  const fileRecord = getTenantStore(tenantId).get(fileName);
  if (!fileRecord) return null;
  return fileRecord[sheetName] ?? null;
}

export function getUploadedFileSheetNames(tenantId: string, fileName: string): string[] {
  const fileRecord = getTenantStore(tenantId).get(fileName);
  if (!fileRecord) return [];
  return Object.keys(fileRecord);
}

export function listUploadedFiles(tenantId: string): Array<{ fileName: string; sheetNames: string[] }> {
  const store = getTenantStore(tenantId);
  const result: Array<{ fileName: string; sheetNames: string[] }> = [];
  for (const [fileName, sheets] of store.entries()) {
    result.push({ fileName, sheetNames: Object.keys(sheets) });
  }
  return result.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export function deleteUploadedFile(tenantId: string, fileName: string): boolean {
  return getTenantStore(tenantId).delete(fileName);
}
