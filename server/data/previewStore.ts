import type { RowRecord } from "../types";

const PREVIEW_PAGE_SIZE = 500;
const previewMap = new Map<string, { headers: string[]; rows: RowRecord[] }>();

export function setPreview(fileName: string, sheetName: string, rows: RowRecord[]) {
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  previewMap.set(`${fileName}::${sheetName}`, { headers, rows });
}

export function getPreviewPage(fileName: string, sheetName: string, offset: number, limit: number) {
  const key = `${fileName}::${sheetName}`;
  const entry = previewMap.get(key);
  if (!entry) return null;
  const safeOffset = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, PREVIEW_PAGE_SIZE) : PREVIEW_PAGE_SIZE;
  const rows = entry.rows.slice(safeOffset, safeOffset + safeLimit);
  return {
    fileName,
    sheetName,
    headers: entry.headers,
    rows,
    offset: safeOffset,
    nextOffset: safeOffset + rows.length,
    totalRows: entry.rows.length,
    hasMore: safeOffset + rows.length < entry.rows.length,
  };
}
