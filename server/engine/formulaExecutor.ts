function safeNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

type SheetData = Record<string, string | number | boolean | null>;

function colToIndex(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + (col.charCodeAt(i) - 64);
  }
  return n - 1;
}

function indexToCol(idx: number): string {
  let n = idx + 1;
  let col = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function readCellValue(cell: string, sheetData?: SheetData): number {
  const raw = sheetData?.[cell];
  if (typeof raw === "number") return raw;
  if (typeof raw === "boolean") return raw ? 1 : 0;
  if (typeof raw === "string") return safeNumber(raw.replace(/,/g, ""));
  return 0;
}

function expandRange(range: string): string[] {
  const [start, end] = range.split(":");
  if (!start || !end) return [];
  const s = start.match(/^([A-Z]+)(\d+)$/i);
  const e = end.match(/^([A-Z]+)(\d+)$/i);
  if (!s || !e) return [];
  const startCol = colToIndex(s[1].toUpperCase());
  const endCol = colToIndex(e[1].toUpperCase());
  const startRow = Number(s[2]);
  const endRow = Number(e[2]);
  const cells: string[] = [];
  for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
    for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
      cells.push(`${indexToCol(c)}${r}`);
    }
  }
  return cells;
}

function evalArithmetic(expr: string): number {
  const allowed = expr.replace(/\s+/g, "");
  if (!/^[0-9+\-*/().]+$/.test(allowed)) return 0;
  const fn = new Function(`return (${allowed});`);
  const result = Number(fn());
  return Number.isFinite(result) ? result : 0;
}

function evalIfFormula(formula: string): number {
  // Minimal deterministic IF evaluator for nested IF numeric formulas.
  // Expected pattern: IF(<lhs><op><rhs>,<trueExpr>,<falseExpr>)
  const match = formula.match(/^IF\((.+)\)$/i);
  if (!match) return 0;
  const body = match[1];

  let depth = 0;
  let split1 = -1;
  let split2 = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      if (split1 === -1) split1 = i;
      else {
        split2 = i;
        break;
      }
    }
  }
  if (split1 === -1 || split2 === -1) return 0;

  const condition = body.slice(0, split1).trim();
  const whenTrue = body.slice(split1 + 1, split2).trim();
  const whenFalse = body.slice(split2 + 1).trim();

  const condMatch = condition.match(/^(.+?)(>=|<=|=|>|<)(.+)$/);
  if (!condMatch) return 0;

  const left = safeNumber(condMatch[1].replace(/[A-Z]+\d+/gi, "0"));
  const op = condMatch[2];
  const right = safeNumber(condMatch[3].replace(/[A-Z]+\d+/gi, "0"));
  const pass =
    op === ">" ? left > right :
    op === "<" ? left < right :
    op === ">=" ? left >= right :
    op === "<=" ? left <= right :
    left === right;

  const branch = pass ? whenTrue : whenFalse;
  if (/^IF\(/i.test(branch)) return evalIfFormula(branch);
  return evalArithmetic(branch.replace(/[A-Z]+\d+/gi, "0"));
}

export function executeFormulaRange(input: {
  formula: string;
  cellRef: string;
  sheetData?: SheetData;
}): Array<number | null> {
  if (!input.formula.startsWith("=")) {
    throw new Error("Cannot execute invalid formula.");
  }

  const formula = input.formula.slice(1).trim();
  if (/^SUM\(/i.test(formula)) {
    const m = formula.match(/^SUM\(([^)]+)\)$/i);
    if (!m) return [0];
    const arg = m[1].trim();
    const cells = arg.includes(":") ? expandRange(arg) : [arg];
    const sum = cells.reduce((acc, c) => acc + readCellValue(c, input.sheetData), 0);
    return [sum];
  }
  if (/^IF\(/i.test(formula)) {
    return [evalIfFormula(formula)];
  }

  const replaced = formula.replace(/[A-Z]+\d+/gi, (cell) => String(readCellValue(cell.toUpperCase(), input.sheetData)));
  return [evalArithmetic(replaced)];
}
