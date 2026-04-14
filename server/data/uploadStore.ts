export type SheetPreviewRow = Record<string, string>;

export type StoredSheet = {
  headers: string[];
  rows: SheetPreviewRow[];
};

const uploadedFileStore = new Map<string, Record<string, StoredSheet>>();

export function setUploadedFileSheets(fileName: string, sheets: Record<string, StoredSheet>): void {
  uploadedFileStore.set(fileName, sheets);
}

export function getUploadedSheet(fileName: string, sheetName: string): StoredSheet | null {
  const fileRecord = uploadedFileStore.get(fileName);
  if (!fileRecord) return null;
  return fileRecord[sheetName] ?? null;
}

export function getUploadedFileSheetNames(fileName: string): string[] {
  const fileRecord = uploadedFileStore.get(fileName);
  if (!fileRecord) return [];
  return Object.keys(fileRecord);
}
