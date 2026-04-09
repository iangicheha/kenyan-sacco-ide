/**
 * cellGraph.ts
 * 
 * Core spreadsheet model for the agentic IDE.
 * Represents a spreadsheet as an in-memory graph of cells with formulas, values, and dependencies.
 */

export interface Cell {
  address: string;
  sheet: string;
  value: string | number | boolean | null;
  formula: string | null;
  type: "text" | "number" | "boolean" | "date" | "formula" | "empty";
  flagged?: string; // Flag type (ghost_account, phantom_savings, etc.)
  flagRationale?: string;
  saccoTag?: string; // Semantic tag (loan_balance, member_id, etc.)
}

export interface SheetGraph {
  sheetName: string;
  rowCount: number;
  colCount: number;
  cells: Map<string, Cell>;
  dependencies: Map<string, Set<string>>; // cell -> cells that depend on it
}

export interface SpreadsheetGraph {
  fileName: string;
  activeSheet: string;
  sheets: Map<string, SheetGraph>;
}

/**
 * Parse XLSX buffer into a SpreadsheetGraph
 * Note: Actual XLSX parsing is handled by the backend server
 */
export function parseSpreadsheet(buffer: Buffer, fileName: string): SpreadsheetGraph {
  // Placeholder: actual implementation uses XLSX library in server
  return {
    fileName,
    activeSheet: "Sheet1",
    sheets: new Map(),
  };
}

/**
 * Parse a single worksheet into a SheetGraph
 */
function parseSheet(data: any[][], sheetName: string): SheetGraph {
  const rowCount = data.length;
  const colCount = data[0]?.length || 0;
  const cells = new Map<string, Cell>();
  const dependencies = new Map<string, Set<string>>();

  // Parse all cells
  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      const cellValue = data[row][col];
      if (cellValue === null || cellValue === undefined) continue;

      const address = `${colNumberToLetter(col)}${row + 1}`.toUpperCase();
      const formula = typeof cellValue === "object" && cellValue.f ? cellValue.f : null;
      const value = cellValue.v ?? cellValue;
      const type = detectCellType(cellValue, formula);

      cells.set(address, {
        address,
        sheet: sheetName,
        value,
        formula,
        type,
      });

      // Track dependencies if formula
      if (formula) {
        const refs = extractCellReferences(formula);
        for (const ref of Array.from(refs)) {
          if (!dependencies.has(ref)) {
            dependencies.set(ref, new Set());
          }
          dependencies.get(ref)!.add(address);
        }
      }
    }
  }

  return {
    sheetName,
    rowCount,
    colCount,
    cells,
    dependencies,
  };
}

/**
 * Detect cell type from value
 */
function detectCellType(
  cellValue: any,
  formula: string | null
): "text" | "number" | "boolean" | "date" | "formula" | "empty" {
  if (formula) return "formula";
  if (cellValue === null || cellValue === undefined) return "empty";
  if (typeof cellValue === "boolean") return "boolean";
  if (typeof cellValue === "number") return "number";
  if (cellValue instanceof Date) return "date";
  return "text";
}

/**
 * Extract cell references from a formula (e.g., "=A1+B2" -> ["A1", "B2"])
 */
function extractCellReferences(formula: string): string[] {
  const cellPattern = /\b([A-Z]{1,3}\d+)\b/g;
  const matches = formula.match(cellPattern) || [];
  return Array.from(new Set(matches)).map((m) => m.toUpperCase());
}

/**
 * Get a single cell from the graph
 */
export function getCell(
  graph: SpreadsheetGraph,
  address: string,
  sheetName?: string
): Cell | null {
  const sheet = sheetName || graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheet);
  if (!sheetGraph) return null;

  return sheetGraph.cells.get(address.toUpperCase()) || null;
}

/**
 * Get a range of cells
 */
export function getRange(
  graph: SpreadsheetGraph,
  startAddress: string,
  endAddress: string,
  sheetName?: string
): Cell[] {
  const sheet = sheetName || graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheet);
  if (!sheetGraph) return [];

  const startCol = startAddress.charCodeAt(0) - 65;
  const startRow = parseInt(startAddress.slice(1)) - 1;
  const endCol = endAddress.charCodeAt(0) - 65;
  const endRow = parseInt(endAddress.slice(1)) - 1;

  const cells: Cell[] = [];
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const cellRef = `${colNumberToLetter(col)}${row + 1}`.toUpperCase();
      const cell = sheetGraph.cells.get(cellRef);
      if (cell) cells.push(cell);
    }
  }

  return cells;
}

/**
 * Find cells that depend on a given cell
 */
export function findDependents(
  graph: SpreadsheetGraph,
  address: string,
  sheetName?: string
): Cell[] {
  const sheet = sheetName || graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheet);
  if (!sheetGraph) return [];

  const dependentAddresses = sheetGraph.dependencies.get(address.toUpperCase()) || new Set();
  const dependents: Cell[] = [];

  for (const depAddress of Array.from(dependentAddresses)) {
    const cell = sheetGraph.cells.get(depAddress);
    if (cell) dependents.push(cell);
  }

  return dependents;
}

/**
 * Get column header (first row value)
 */
export function getColumnHeader(
  graph: SpreadsheetGraph,
  address: string,
  sheetName?: string
): string | null {
  const sheet = sheetName || graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheet);
  if (!sheetGraph) return null;

  const col = address.charCodeAt(0) - 65;
  const headerRef = `${colNumberToLetter(col)}1`.toUpperCase();
  const headerCell = sheetGraph.cells.get(headerRef);

  return headerCell?.value ? String(headerCell.value) : null;
}

/**
 * Serialize a range of cells to LLM-friendly format
 */
export function serializeForLLM(
  graph: SpreadsheetGraph,
  startAddress: string,
  endAddress: string
): string {
  const cells = getRange(graph, startAddress, endAddress);
  if (cells.length === 0) return "No data in range";

  // Group by row
  const rows = new Map<number, Cell[]>();
  for (const cell of cells) {
    const row = parseInt(cell.address.slice(1)) - 1;
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push(cell);
  }

  // Format as table
  let output = "";
  for (const [, rowCells] of Array.from(rows)) {
    const rowData = rowCells.map((c: Cell) => {
      if (c.formula) return `${c.address}:${c.formula}`;
      return `${c.address}:${c.value}`;
    });
    output += rowData.join(" | ") + "\n";
  }

  return output;
}

/**
 * Propose a write operation (staged edit)
 */
export function proposeWrite(
  graph: SpreadsheetGraph,
  address: string,
  value: string | number | null,
  formula: string | null,
  sheetName?: string
): { old: Cell | null; updated: Cell } {
  const sheet = sheetName || graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheet);
  if (!sheetGraph) throw new Error(`Sheet ${sheet} not found`);

  const upperAddress = address.toUpperCase();
  const old = sheetGraph.cells.get(upperAddress) || null;

  const updated: Cell = {
    address: upperAddress,
    sheet,
    value,
    formula,
    type: formula ? "formula" : detectCellType(value, null),
  };

  // Stage the update (don't commit yet)
  const stagingKey = `~${upperAddress}`;
  sheetGraph.cells.set(stagingKey, updated);

  return { old, updated };
}

/**
 * Commit a staged write
 */
export function commitWrite(
  graph: SpreadsheetGraph,
  address: string,
  sheetName?: string
): void {
  const sheet = sheetName || graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheet);
  if (!sheetGraph) throw new Error(`Sheet ${sheet} not found`);

  const upperAddress = address.toUpperCase();
  const stagingKey = `~${upperAddress}`;
  const staged = sheetGraph.cells.get(stagingKey);

  if (staged) {
    sheetGraph.cells.set(upperAddress, staged);
    sheetGraph.cells.delete(stagingKey);
  }
}

/**
 * Reject a staged write
 */
export function rejectWrite(
  graph: SpreadsheetGraph,
  address: string,
  sheetName?: string
): void {
  const sheet = sheetName || graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheet);
  if (!sheetGraph) throw new Error(`Sheet ${sheet} not found`);

  const stagingKey = `~${address.toUpperCase()}`;
  sheetGraph.cells.delete(stagingKey);
}

/**
 * Export graph to 2D array format
 */
export function exportToArray(graph: SpreadsheetGraph): any[][] {
  const sheet = graph.sheets.get(graph.activeSheet);
  if (!sheet) return [];

  const data: any[][] = [];

  for (let row = 0; row < sheet.rowCount; row++) {
    const rowData: any[] = [];
    for (let col = 0; col < sheet.colCount; col++) {
      const cellRef = `${colNumberToLetter(col)}${row + 1}`.toUpperCase();
      const cell = sheet.cells.get(cellRef);
      if (cell && cell.formula) {
        rowData.push({ f: cell.formula, v: cell.value });
      } else if (cell) {
        rowData.push(cell.value);
      } else {
        rowData.push("");
      }
    }
    data.push(rowData);
  }

  return data;
}

/**
 * Convert column number to letter (0 -> A, 1 -> B, etc.)
 */
export function colNumberToLetter(num: number): string {
  let letter = "";
  let n = num;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/**
 * Convert column letter to number (A -> 0, B -> 1, etc.)
 */
export function colLetterToNumber(letter: string): number {
  let num = 0;
  for (let i = 0; i < letter.length; i++) {
    num = num * 26 + (letter.charCodeAt(i) - 64);
  }
  return num - 1;
}
