/**
 * cell_graph.ts
 *
 * The foundation of the Meridian-style architecture.
 * Parses an uploaded .xlsx or .csv file into a live in-memory
 * cell graph — a Map where every cell has an address, value,
 * formula, type, and a list of cells it depends on.
 *
 * This is the "AST" for the spreadsheet. The LLM never sees
 * raw file bytes — it sees this structured graph.
 */

import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CellType =
  | "number"
  | "string"
  | "formula"
  | "boolean"
  | "empty"
  | "date";

export interface Cell {
  address: string; // e.g. "B7"  (col + row, no sheet prefix)
  sheet: string; // sheet/tab name
  value: string | number | boolean | null; // computed value
  formula: string | null; // raw formula string e.g. "=C7*1.05"
  type: CellType;
  format: string | null; // number format string if any e.g. "#,##0.00"
  dependsOn: string[]; // addresses this cell's formula references
  // Kenyan SACCO domain tags — set by tool_registry
  saccoTag?: SaccoTag; // e.g. "member_id", "loan_balance", "provision"
  flagged?: FlagType; // e.g. "ghost_account", "phantom_savings"
  flagRationale?: string;
}

export type SaccoTag =
  | "member_id"
  | "member_name"
  | "phone"
  | "loan_balance"
  | "loan_days_overdue"
  | "provision_rate"
  | "provision_amount"
  | "savings_balance"
  | "dividend"
  | "share_capital";

export type FlagType =
  | "ghost_account"
  | "phantom_savings"
  | "unremitted_deduction"
  | "compliance_breach"
  | "data_anomaly";

export interface SheetGraph {
  name: string;
  cells: Map<string, Cell>; // key = "B7"
  rowCount: number;
  colCount: number;
  headers: Map<string, string>; // col letter → header label e.g. "B" → "Loan Balance"
}

export interface SpreadsheetGraph {
  fileName: string;
  sheets: Map<string, SheetGraph>; // key = sheet name
  activeSheet: string;
  parsedAt: Date;
}

// ── Formula dependency parser ─────────────────────────────────────────────────

/**
 * Extracts all cell references from a formula string.
 * Handles: A1, $A$1, A1:B10, Sheet2!A1 style refs.
 */
function extractDependencies(formula: string): string[] {
  if (!formula) return [];

  const deps = new Set<string>();

  // Match cell references: optional sheet prefix, optional $, col, optional $, row
  const cellRefPattern = /(?:[A-Za-z0-9_]+!)?(\$?[A-Z]{1,3}\$?[0-9]{1,7})/g;
  let match;

  while ((match = cellRefPattern.exec(formula)) !== null) {
    // Normalise: strip $ signs, uppercase
    const ref = match[1].replace(/\$/g, "").toUpperCase();
    deps.add(ref);
  }

  // Expand range references like A1:B10 into individual cells
  const rangePattern = /([A-Z]{1,3})(\d+):([A-Z]{1,3})(\d+)/g;
  while ((match = rangePattern.exec(formula)) !== null) {
    const [, startCol, startRow, endCol, endRow] = match;
    const startColNum = colLetterToNumber(startCol);
    const endColNum = colLetterToNumber(endCol);
    const startRowNum = parseInt(startRow);
    const endRowNum = parseInt(endRow);

    for (let c = startColNum; c <= endColNum; c++) {
      for (let r = startRowNum; r <= endRowNum; r++) {
        deps.add(`${colNumberToLetter(c)}${r}`);
      }
    }
  }

  return Array.from(deps);
}

function colLetterToNumber(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + col.charCodeAt(i) - 64;
  }
  return n;
}

function colNumberToLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function normalizeAddress(address: string): string {
  const upper = String(address ?? "").trim().toUpperCase();
  if (!/^[A-Z]{1,3}[1-9][0-9]{0,6}$/.test(upper)) {
    throw new Error(`Invalid cell address "${address}"`);
  }
  return upper;
}

function getCellForDependencyTraversal(
  sheetGraph: SheetGraph,
  address: string
): Cell | undefined {
  return sheetGraph.cells.get(`~${address}`) ?? sheetGraph.cells.get(address);
}

function wouldIntroduceCircularReference(
  graph: SpreadsheetGraph,
  address: string,
  newFormula: string,
  sheet?: string
): boolean {
  const sheetName = sheet ?? graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheetName);
  if (!sheetGraph) return false;

  const target = normalizeAddress(address);
  const initialDeps = extractDependencies(newFormula);
  if (initialDeps.includes(target)) return true;

  const seen = new Set<string>();
  const stack = [...initialDeps];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);

    const cell = getCellForDependencyTraversal(sheetGraph, current);
    if (!cell?.formula) continue;
    for (const dep of cell.dependsOn) {
      if (!seen.has(dep)) stack.push(dep);
    }
  }

  return false;
}

// ── Cell type inference ───────────────────────────────────────────────────────

function inferType(cellData: XLSX.CellObject | undefined): CellType {
  if (!cellData || cellData.v === undefined || cellData.v === null)
    return "empty";
  if (cellData.f) return "formula";
  if (cellData.t === "n") return "number";
  if (cellData.t === "b") return "boolean";
  if (cellData.t === "d") return "date";
  return "string";
}

// ── Core parser ───────────────────────────────────────────────────────────────

/**
 * Parse an xlsx/csv buffer into a SpreadsheetGraph.
 * This is called once when a file is uploaded — the result
 * is kept in memory for the duration of the session.
 */
export function parseSpreadsheet(
  buffer: Buffer,
  fileName: string
): SpreadsheetGraph {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellFormula: true, // preserve formula strings
    cellDates: true,
    cellNF: true, // preserve number formats
  });

  const graph: SpreadsheetGraph = {
    fileName,
    sheets: new Map(),
    activeSheet: workbook.SheetNames[0],
    parsedAt: new Date(),
  };

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const sheetGraph = parseSheet(ws, sheetName);
    graph.sheets.set(sheetName, sheetGraph);
  }

  return graph;
}

function parseSheet(ws: XLSX.WorkSheet, name: string): SheetGraph {
  const cells = new Map<string, Cell>();
  const headers = new Map<string, string>();

  const ref = ws["!ref"];
  if (!ref) {
    return { name, cells, rowCount: 0, colCount: 0, headers };
  }

  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;

  // First pass — extract header row (row 1)
  for (let c = range.s.c; c <= range.e.c; c++) {
    const headerAddr = XLSX.utils.encode_cell({ r: range.s.r, c });
    const headerCell = ws[headerAddr];
    if (headerCell && headerCell.v) {
      const colLetter = colNumberToLetter(c + 1);
      headers.set(colLetter, String(headerCell.v).trim());
    }
  }

  // Second pass — all cells
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const xlsxAddr = XLSX.utils.encode_cell({ r, c });
      const cellData = ws[xlsxAddr] as XLSX.CellObject | undefined;

      const colLetter = colNumberToLetter(c + 1);
      const address = `${colLetter}${r + 1}`;

      const formula = cellData?.f ? `=${cellData.f}` : null;
      const value =
        cellData?.v !== undefined && cellData?.v !== null
          ? cellData.v
          : null;
      const type = inferType(cellData);
      const format = cellData?.z ? String(cellData.z) : null;
      const dependsOn = formula ? extractDependencies(formula) : [];

      const cell: Cell = {
        address,
        sheet: name,
        value: value as string | number | boolean | null,
        formula,
        type,
        format,
        dependsOn,
      };

      cells.set(address, cell);
    }
  }

  return { name, cells, rowCount, colCount, headers };
}

// ── Graph query helpers ───────────────────────────────────────────────────────

/**
 * Get a cell from the active sheet by address.
 */
export function getCell(
  graph: SpreadsheetGraph,
  address: string,
  sheet?: string
): Cell | undefined {
  const sheetName = sheet ?? graph.activeSheet;
  return graph.sheets.get(sheetName)?.cells.get(normalizeAddress(address));
}

/**
 * Get a range of cells as a Cell[].
 */
export function getRange(
  graph: SpreadsheetGraph,
  from: string,
  to: string,
  sheet?: string
): Cell[] {
  const sheetName = sheet ?? graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheetName);
  if (!sheetGraph) return [];

  const fromRange = XLSX.utils.decode_cell(from.toUpperCase());
  const toRange = XLSX.utils.decode_cell(to.toUpperCase());
  const cells: Cell[] = [];

  for (let r = fromRange.r; r <= toRange.r; r++) {
    for (let c = fromRange.c; c <= toRange.c; c++) {
      const colLetter = colNumberToLetter(c + 1);
      const address = `${colLetter}${r + 1}`;
      const cell = sheetGraph.cells.get(address);
      if (cell) cells.push(cell);
    }
  }

  return cells;
}

/**
 * Find all cells that depend on a given address (reverse deps).
 * Used to warn the user before a write: "changing D7 will affect F7, F12, Summary!B3"
 */
export function findDependents(
  graph: SpreadsheetGraph,
  address: string,
  sheet?: string
): Cell[] {
  const sheetName = sheet ?? graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheetName);
  if (!sheetGraph) return [];

  const upper = normalizeAddress(address);
  const dependents: Cell[] = [];

  for (const cell of sheetGraph.cells.values()) {
    if (cell.dependsOn.includes(upper)) {
      dependents.push(cell);
    }
  }

  return dependents;
}

/**
 * Serialize a range into a compact string for LLM context.
 * Keeps token count low — only address, value, formula.
 */
export function serializeForLLM(
  graph: SpreadsheetGraph,
  from: string,
  to: string,
  sheet?: string
): string {
  const cells = getRange(graph, from, to, sheet);
  const lines = cells
    .filter((c) => c.type !== "empty")
    .map((c) => {
      const formula = c.formula ? ` [formula: ${c.formula}]` : "";
      const flag = c.flagged ? ` ⚠ ${c.flagged}` : "";
      return `${c.address}: ${c.value}${formula}${flag}`;
    });
  return lines.join("\n");
}

/**
 * Get the header label for a column by cell address.
 * e.g. "D7" → looks up column D header → "Loan Balance"
 */
export function getColumnHeader(
  graph: SpreadsheetGraph,
  address: string,
  sheet?: string
): string | undefined {
  const sheetName = sheet ?? graph.activeSheet;
  const upper = normalizeAddress(address);
  const colLetter = upper.replace(/[0-9]/g, "");
  return graph.sheets.get(sheetName)?.headers.get(colLetter);
}

/**
 * Write a proposed value/formula to a cell IN MEMORY only.
 * Does NOT commit — that is done by diff_store after user approval.
 * Returns the old cell state so diff_store can record the change.
 */
export function proposeWrite(
  graph: SpreadsheetGraph,
  address: string,
  newValue: string | number | null,
  newFormula: string | null,
  sheet?: string
): { old: Cell | undefined; updated: Cell } {
  const sheetName = sheet ?? graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheetName);

  if (!sheetGraph) {
    throw new Error(`Sheet "${sheetName}" not found in graph`);
  }

  const upper = normalizeAddress(address);
  const existing = sheetGraph.cells.get(upper);

  if (newFormula && wouldIntroduceCircularReference(graph, upper, newFormula, sheetName)) {
    throw new Error(
      `Rejected write to ${upper}: formula introduces a circular reference`
    );
  }

  const updated: Cell = {
    address: upper,
    sheet: sheetName,
    value: newValue,
    formula: newFormula,
    type: newFormula ? "formula" : typeof newValue === "number" ? "number" : "string",
    format: existing?.format ?? null,
    dependsOn: newFormula ? extractDependencies(newFormula) : [],
    saccoTag: existing?.saccoTag,
  };

  // Write to a STAGING key so it is visible to the diff engine
  // but clearly not yet committed — prefix with "~"
  sheetGraph.cells.set(`~${upper}`, updated);

  return { old: existing, updated };
}

/**
 * Commit a proposed write (after user accepts the diff).
 * Replaces the staging cell with the live cell.
 */
export function commitWrite(
  graph: SpreadsheetGraph,
  address: string,
  sheet?: string
): void {
  const sheetName = sheet ?? graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheetName);
  if (!sheetGraph) return;

  const upper = address.toUpperCase();
  const staged = sheetGraph.cells.get(`~${upper}`);
  if (!staged) return;

  sheetGraph.cells.set(upper, staged);
  sheetGraph.cells.delete(`~${upper}`);
}

/**
 * Reject a proposed write — discard the staging cell.
 */
export function rejectWrite(
  graph: SpreadsheetGraph,
  address: string,
  sheet?: string
): void {
  const sheetName = sheet ?? graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheetName);
  if (!sheetGraph) return;

  sheetGraph.cells.delete(`~${address.toUpperCase()}`);
}

/**
 * Export the live (committed) graph back to an xlsx buffer.
 * Called when user clicks "Download" or "Export to Excel".
 */
export function exportToBuffer(graph: SpreadsheetGraph): Buffer {
  const wb = XLSX.utils.book_new();

  for (const [sheetName, sheetGraph] of graph.sheets) {
    const ws: XLSX.WorkSheet = {};
    let maxRow = 0;
    let maxCol = 0;

    for (const [addr, cell] of sheetGraph.cells) {
      // Skip staging cells
      if (addr.startsWith("~")) continue;
      if (cell.type === "empty") continue;

      const decoded = XLSX.utils.decode_cell(addr);
      maxRow = Math.max(maxRow, decoded.r);
      maxCol = Math.max(maxCol, decoded.c);

      const xlCell: XLSX.CellObject = {
        v: cell.value as XLSX.CellObject["v"],
        t: cell.type === "number" ? "n"
          : cell.type === "boolean" ? "b"
          : cell.type === "date" ? "d"
          : "s",
      };

      if (cell.formula) {
        xlCell.f = cell.formula.startsWith("=")
          ? cell.formula.slice(1)
          : cell.formula;
      }

      if (cell.format) xlCell.z = cell.format;

      ws[addr] = xlCell;
    }

    ws["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: maxRow, c: maxCol },
    });

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
