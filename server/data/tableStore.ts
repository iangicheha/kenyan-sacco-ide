import XLSX from "xlsx";
import type { DataTable, RowRecord, TableSchema } from "../types";

const tables = new Map<string, DataTable>();
const tableHistory = new Map<string, DataTable[]>();

function inferColumnType(values: unknown[]): "string" | "number" | "date" | "boolean" {
  const filtered = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (filtered.length === 0) return "string";
  if (filtered.every((v) => typeof v === "boolean")) return "boolean";
  if (filtered.every((v) => Number.isFinite(Number(v)))) return "number";
  if (filtered.every((v) => !Number.isNaN(new Date(String(v)).getTime()))) return "date";
  return "string";
}

function inferSchema(tableName: string, rows: RowRecord[]): TableSchema {
  const cols = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => cols.add(k)));
  const columns = Array.from(cols).map((name) => ({
    name,
    type: inferColumnType(rows.map((r) => r[name])),
  }));
  return { tableName, columns };
}

export function upsertTable(name: string, rows: RowRecord[]): DataTable {
  const schema = inferSchema(name, rows);
  const current = tables.get(name);
  const nextVersion = (current?.version ?? 0) + 1;
  const table: DataTable = {
    name,
    schema,
    rows,
    version: nextVersion,
    updatedAt: new Date().toISOString(),
  };
  tables.set(name, table);
  const history = tableHistory.get(name) ?? [];
  history.push(table);
  tableHistory.set(name, history);
  return table;
}

export function getTable(name: string): DataTable | undefined {
  return tables.get(name);
}

export function getTableByVersion(name: string, version: number): DataTable | undefined {
  const history = tableHistory.get(name) ?? [];
  return history.find((snapshot) => snapshot.version === version);
}

export function listSchemas(): TableSchema[] {
  return Array.from(tables.values()).map((t) => t.schema);
}

export function getCurrentSchemaVersion(name: string): number | null {
  const table = tables.get(name);
  return table ? table.version : null;
}

export function listTableVersions(name: string): number[] {
  const history = tableHistory.get(name) ?? [];
  return history.map((snapshot) => snapshot.version);
}

export function rollbackTable(name: string, version: number): DataTable {
  const snapshot = getTableByVersion(name, version);
  if (!snapshot) {
    throw new Error(`No snapshot found for table "${name}" version ${version}`);
  }
  const restoredRows = snapshot.rows.map((row) => ({ ...row }));
  return upsertTable(name, restoredRows);
}

export function clearTablesForTests() {
  tables.clear();
  tableHistory.clear();
}

export function parseWorkbookBuffer(fileName: string, buffer: Buffer): DataTable[] {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false, cellDates: true });
  const out: DataTable[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<RowRecord>(sheet, { defval: null });
    const tableName = `${fileName}::${sheetName}`;
    out.push(upsertTable(tableName, rows));
  }
  return out;
}
