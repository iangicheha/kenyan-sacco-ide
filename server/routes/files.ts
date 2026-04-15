import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { getUploadedSheet, setUploadedFileSheets, type SheetPreviewRow, type StoredSheet } from "../data/uploadStore.js";
import { userHasAnyRole, type AuthenticatedRequest } from "../middleware/auth.js";

export const filesRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });
const PREVIEW_PAGE_SIZE = 500;

function toCellString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseCsv(content: string): { headers: string[]; rows: SheetPreviewRow[] } {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: SheetPreviewRow[] = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: SheetPreviewRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    return row;
  });

  return { headers, rows };
}

function parseExcel(buffer: Buffer): Record<string, StoredSheet> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetMap: Record<string, StoredSheet> = {};

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
      header: 1,
      raw: false,
      blankrows: false,
    });

    const headerRow = (matrix[0] ?? []).map((cell, idx) => {
      const text = toCellString(cell).trim();
      return text || `Column ${idx + 1}`;
    });

    const rows: SheetPreviewRow[] = matrix.slice(1).map((cells) => {
      const row: SheetPreviewRow = {};
      headerRow.forEach((header, idx) => {
        row[header] = toCellString(cells[idx]);
      });
      return row;
    });

    sheetMap[sheetName] = { headers: headerRow, rows };
  });

  return sheetMap;
}

filesRouter.post("/upload", upload.array("files"), (req, res) => {
  const request = req as AuthenticatedRequest;
  if (!request.user) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  if (!userHasAnyRole(request, ["analyst", "admin"])) {
    return res.status(403).json({ error: "Forbidden. Analyst or admin role required for upload." });
  }

  const files = ((req as any).files ?? []) as Array<{ originalname: string; buffer: Buffer }>;
  if (files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const parsedFiles = files.map((file) => {
    const lower = file.originalname.toLowerCase();
    let sheetRecord: Record<string, StoredSheet> = {};

    if (lower.endsWith(".csv")) {
      const parsed = parseCsv(file.buffer.toString("utf-8"));
      sheetRecord = {
        Sheet1: {
          headers: parsed.headers,
          rows: parsed.rows,
        },
      };
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      sheetRecord = parseExcel(file.buffer);
    } else {
      sheetRecord = {
        Sheet1: { headers: [], rows: [] },
      };
    }

    setUploadedFileSheets(request.user.tenantId, file.originalname, sheetRecord);

    const sheetNames = Object.keys(sheetRecord);
    const defaultSheetName = sheetNames[0] ?? "Sheet1";
    const sheets = sheetNames.map((sheetName) => {
      const sheet = sheetRecord[sheetName];
      const totalRows = sheet.rows.length;
      const previewRows = sheet.rows.slice(0, PREVIEW_PAGE_SIZE);

      return {
        sheetName,
        headers: sheet.headers,
        previewRows,
        totalRows,
        previewTruncated: totalRows > PREVIEW_PAGE_SIZE,
      };
    });

    return {
      fileName: file.originalname,
      defaultSheetName,
      sheets,
    };
  });

  return res.json({ parsedFiles });
});

filesRouter.get("/upload/preview", (req, res) => {
  const request = req as AuthenticatedRequest;
  if (!request.user) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  if (!userHasAnyRole(request, ["read-only", "reviewer", "analyst", "admin"])) {
    return res.status(403).json({ error: "Forbidden. Preview role not allowed." });
  }

  const fileName = String(req.query.fileName ?? "");
  const sheetName = String(req.query.sheetName ?? "");
  const offset = Math.max(0, Number(req.query.offset ?? 0));
  const limit = Math.max(1, Number(req.query.limit ?? PREVIEW_PAGE_SIZE));

  const sheet = getUploadedSheet(request.user.tenantId, fileName, sheetName);
  if (!sheet) {
    return res.status(404).json({ error: "Sheet not found in preview cache" });
  }

  const rows = sheet.rows.slice(offset, offset + limit);
  const nextOffset = offset + rows.length;
  return res.json({
    rows,
    totalRows: sheet.rows.length,
    nextOffset,
  });
});

filesRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Files route scaffold is ready.",
  });
});
