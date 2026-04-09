import { Router } from "express";
import multer from "multer";
import { parseWorkbookBuffer } from "../../data/tableStore";
import { getPreviewPage, setPreview } from "../../data/previewStore";
import { requireRole } from "../../middleware/apiAuth";

export const uploadRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

uploadRouter.post("/upload", requireRole("admin"), upload.array("files"), (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) return res.status(400).json({ message: "No files uploaded." });

  const parsedFiles = files.flatMap((file) => {
    const tables = parseWorkbookBuffer(file.originalname, file.buffer);
    return tables.map((table) => {
      const [fileName, sheetName] = table.name.split("::");
      setPreview(fileName, sheetName, table.rows);
      return {
        fileName,
        defaultSheetName: sheetName,
        kind: "unknown",
        sheets: [
          {
            sheetName,
            headers: table.schema.columns.map((c) => c.name),
            previewRows: table.rows.slice(0, 500),
            totalRows: table.rows.length,
            previewTruncated: table.rows.length > 500,
          },
        ],
      };
    });
  });

  return res.status(200).json({ message: "Files uploaded and parsed successfully.", parsedFiles });
});

uploadRouter.get("/upload/preview", requireRole("read-only"), (req, res) => {
  const fileName = String(req.query.fileName ?? "");
  const sheetName = String(req.query.sheetName ?? "");
  const offset = Number(req.query.offset ?? 0);
  const limit = Number(req.query.limit ?? 500);
  if (!fileName || !sheetName) {
    return res.status(400).json({ message: "fileName and sheetName are required" });
  }
  const page = getPreviewPage(fileName, sheetName, offset, limit);
  if (!page) return res.status(404).json({ message: "File preview not found. Please upload again." });
  return res.status(200).json(page);
});
