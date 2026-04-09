import { Router } from "express";
import {
  getTable,
  listTableVersions,
  rollbackTable,
} from "../../data/tableStore";
import { requireRole } from "../../middleware/apiAuth";

export const tablesRouter = Router();

tablesRouter.get("/tables/:tableName/versions", requireRole("read-only"), (req, res) => {
  const tableName = decodeURIComponent(String(req.params.tableName ?? ""));
  const table = getTable(tableName);
  if (!table) return res.status(404).json({ error: "Table not found" });
  return res.status(200).json({
    tableName,
    currentVersion: table.version,
    versions: listTableVersions(tableName),
  });
});

tablesRouter.post("/tables/:tableName/rollback", requireRole("admin"), (req, res) => {
  const tableName = decodeURIComponent(String(req.params.tableName ?? ""));
  const version = Number(req.body?.version);
  if (!Number.isInteger(version) || version <= 0) {
    return res.status(400).json({ error: "version must be a positive integer" });
  }
  try {
    const restored = rollbackTable(tableName, version);
    return res.status(200).json({
      ok: true,
      tableName,
      rolledBackToVersion: version,
      newVersion: restored.version,
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Rollback failed" });
  }
});
