/**
 * tool_registry.ts
 *
 * This is where your existing SACCO domain logic (normalizePhone,
 * isNameMatch, calculateProvisioning, analyzeForensics) is
 * re-expressed as TYPED TOOLS that the LLM can call by name.
 *
 * The LLM never calls these directly — it emits a ToolCall object,
 * the engine executes it, and the result is a CellOperation that
 * goes into diff_store for user approval.
 *
 * This is the exact same pattern as Cursor's tool use:
 *   LLM → str_replace("file.ts", old, new)
 *   We  → write_formula("D7", "=C7*1.05", "provisioning rule")
 */

import {
  SpreadsheetGraph,
  Cell,
  FlagType,
  SaccoTag,
  getCell,
  getRange,
  proposeWrite,
  findDependents,
  getColumnHeader,
} from "./cell_graph";

// ── Tool call / result types ──────────────────────────────────────────────────

export interface ToolCall {
  tool: string; // e.g. "write_formula"
  args: Record<string, unknown>;
  rationale: string; // LLM must always explain why
}

export interface CellOperation {
  id: string; // uuid for this operation
  tool: string;
  address: string;
  sheet: string;
  oldValue: string | number | boolean | null;
  oldFormula: string | null;
  newValue: string | number | boolean | null;
  newFormula: string | null;
  rationale: string;
  affectedBy: string[]; // downstream cells that will change
  status: "pending" | "accepted" | "rejected";
  timestamp: Date;
}

export interface ToolResult {
  success: boolean;
  operations: CellOperation[];
  message: string; // shown in the chat sidebar
  cellLinks: CellLink[]; // clickable cell references for the UI
}

export interface CellLink {
  label: string; // e.g. "D7"
  address: string;
  sheet: string;
  tooltip: string; // shown on hover
}

// ── ID generator ─────────────────────────────────────────────────────────────

let opCounter = 0;
function newOpId(): string {
  return `op_${Date.now()}_${++opCounter}`;
}

function makeCellLink(cell: Cell, tooltip: string): CellLink {
  return {
    label: cell.address,
    address: cell.address,
    sheet: cell.sheet,
    tooltip,
  };
}

// ── Kenyan SACCO domain helpers ───────────────────────────────────────────────

/**
 * Standardise phone to 254XXXXXXXXX format.
 * Handles: 07XX, +254XX, 254XX, 7XX
 */
export function normalizePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10)
    return "254" + digits.slice(1);
  if (digits.startsWith("7") && digits.length === 9) return "254" + digits;
  return digits; // return as-is if unrecognisable
}

/**
 * Fuzzy name match — sorts words and compares.
 * "Kipchoge John" === "John Kipchoge" → true
 */
export function isNameMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .sort()
      .join(" ");
  return normalize(a) === normalize(b);
}

/**
 * SASRA Form 4 provisioning rates by days overdue.
 * Source: SASRA Prudential Guidelines 2020.
 */
export function sasraProvisionRate(daysOverdue: number): number {
  if (daysOverdue <= 0) return 0.01; // performing — 1%
  if (daysOverdue <= 30) return 0.05; // watch — 5%
  if (daysOverdue <= 90) return 0.25; // substandard — 25%
  if (daysOverdue <= 180) return 0.5; // doubtful — 50%
  return 1.0; // loss — 100%
}

export function sasraProvisionLabel(daysOverdue: number): string {
  if (daysOverdue <= 0) return "Performing";
  if (daysOverdue <= 30) return "Watch";
  if (daysOverdue <= 90) return "Substandard";
  if (daysOverdue <= 180) return "Doubtful";
  return "Loss";
}

// ── Tool implementations ──────────────────────────────────────────────────────

/**
 * TOOL: read_cell
 * Returns the current value and formula at an address.
 * The LLM calls this before proposing a write to understand context.
 */
function tool_read_cell(
  graph: SpreadsheetGraph,
  args: { address: string; sheet?: string },
  rationale: string
): ToolResult {
  const cell = getCell(graph, args.address, args.sheet);

  if (!cell || cell.type === "empty") {
    return {
      success: true,
      operations: [],
      message: `Cell ${args.address} is empty.`,
      cellLinks: [],
    };
  }

  const header = getColumnHeader(graph, args.address, args.sheet);
  const headerNote = header ? ` (column: "${header}")` : "";
  const formulaNote = cell.formula ? ` | formula: \`${cell.formula}\`` : "";
  const flagNote = cell.flagged ? ` | ⚠ flagged: ${cell.flagged}` : "";

  return {
    success: true,
    operations: [],
    message: `[${args.address}]${headerNote} = ${cell.value}${formulaNote}${flagNote}`,
    cellLinks: [makeCellLink(cell, `${cell.value}${formulaNote}`)],
  };
}

/**
 * TOOL: write_formula
 * Proposes writing a formula to a cell.
 * Goes into diff_store as PENDING — not committed until user accepts.
 */
function tool_write_formula(
  graph: SpreadsheetGraph,
  args: { address: string; formula: string; sheet?: string },
  rationale: string
): ToolResult {
  const sheetName = args.sheet ?? graph.activeSheet;
  const { old, updated } = proposeWrite(
    graph,
    args.address,
    null,
    args.formula,
    sheetName
  );

  const dependents = findDependents(graph, args.address, sheetName);
  const affectedBy = dependents.map((c) => c.address);

  const op: CellOperation = {
    id: newOpId(),
    tool: "write_formula",
    address: args.address.toUpperCase(),
    sheet: sheetName,
    oldValue: old?.value ?? null,
    oldFormula: old?.formula ?? null,
    newValue: null,
    newFormula: args.formula,
    rationale,
    affectedBy,
    status: "pending",
    timestamp: new Date(),
  };

  const links: CellLink[] = [
    makeCellLink(updated, `New formula: ${args.formula}`),
    ...dependents.map((d) =>
      makeCellLink(d, `Will be affected by change to ${args.address}`)
    ),
  ];

  const affectedNote =
    affectedBy.length > 0
      ? ` This will cascade to: ${affectedBy.join(", ")}.`
      : "";

  return {
    success: true,
    operations: [op],
    message: `Proposed formula \`${args.formula}\` in [${args.address}].${affectedNote} Please review and accept or reject.`,
    cellLinks: links,
  };
}

/**
 * TOOL: write_value
 * Proposes writing a plain value (not a formula) to a cell.
 */
function tool_write_value(
  graph: SpreadsheetGraph,
  args: { address: string; value: string | number; sheet?: string },
  rationale: string
): ToolResult {
  const sheetName = args.sheet ?? graph.activeSheet;
  const { old, updated } = proposeWrite(
    graph,
    args.address,
    args.value,
    null,
    sheetName
  );

  const dependents = findDependents(graph, args.address, sheetName);
  const affectedBy = dependents.map((c) => c.address);

  const op: CellOperation = {
    id: newOpId(),
    tool: "write_value",
    address: args.address.toUpperCase(),
    sheet: sheetName,
    oldValue: old?.value ?? null,
    oldFormula: old?.formula ?? null,
    newValue: args.value,
    newFormula: null,
    rationale,
    affectedBy,
    status: "pending",
    timestamp: new Date(),
  };

  return {
    success: true,
    operations: [op],
    message: `Proposed value \`${args.value}\` in [${args.address}]. Old value was \`${old?.value ?? "empty"}\`. Please review.`,
    cellLinks: [makeCellLink(updated, `New value: ${args.value}`)],
  };
}

/**
 * TOOL: flag_cell
 * Marks a cell with a SACCO-specific fraud/compliance flag.
 * Does NOT change the cell value — purely annotates it.
 * The UI renders flagged cells with a red border + tooltip.
 */
function tool_flag_cell(
  graph: SpreadsheetGraph,
  args: { address: string; flag: FlagType; sheet?: string },
  rationale: string
): ToolResult {
  const sheetName = args.sheet ?? graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheetName);
  if (!sheetGraph) {
    return {
      success: false,
      operations: [],
      message: `Sheet "${sheetName}" not found.`,
      cellLinks: [],
    };
  }

  const upper = args.address.toUpperCase();
  const cell = sheetGraph.cells.get(upper);

  if (!cell) {
    return {
      success: false,
      operations: [],
      message: `Cell ${upper} not found in sheet "${sheetName}".`,
      cellLinks: [],
    };
  }

  // Apply flag directly (flags don't need user approval — they are annotations)
  cell.flagged = args.flag;
  cell.flagRationale = rationale;
  sheetGraph.cells.set(upper, cell);

  const flagLabels: Record<FlagType, string> = {
    ghost_account: "Ghost Account",
    phantom_savings: "Phantom Savings",
    unremitted_deduction: "Unremitted Deduction",
    compliance_breach: "Compliance Breach",
    data_anomaly: "Data Anomaly",
  };

  return {
    success: true,
    operations: [],
    message: `⚠ Flagged [${upper}] as **${flagLabels[args.flag]}**: ${rationale}`,
    cellLinks: [makeCellLink(cell, `${flagLabels[args.flag]}: ${rationale}`)],
  };
}

/**
 * TOOL: tag_cell
 * Assigns a SACCO semantic tag to a cell (e.g. "loan_balance").
 * Used by the LLM to understand column roles before writing formulas.
 */
function tool_tag_cell(
  graph: SpreadsheetGraph,
  args: { address: string; tag: SaccoTag; sheet?: string },
  rationale: string
): ToolResult {
  const sheetName = args.sheet ?? graph.activeSheet;
  const sheetGraph = graph.sheets.get(sheetName);
  if (!sheetGraph) {
    return { success: false, operations: [], message: "Sheet not found.", cellLinks: [] };
  }

  const upper = args.address.toUpperCase();
  const cell = sheetGraph.cells.get(upper);
  if (!cell) {
    return { success: false, operations: [], message: `Cell ${upper} not found.`, cellLinks: [] };
  }

  cell.saccoTag = args.tag;
  sheetGraph.cells.set(upper, cell);

  return {
    success: true,
    operations: [],
    message: `Tagged [${upper}] as \`${args.tag}\`.`,
    cellLinks: [makeCellLink(cell, `Tag: ${args.tag}`)],
  };
}

/**
 * TOOL: apply_sasra_provisioning
 * For a given row range where column A = days_overdue and column B = loan_balance,
 * proposes provisioning formula for each row into a target column.
 *
 * This is calculateProvisioning() re-expressed as a cell-level tool.
 */
function tool_apply_sasra_provisioning(
  graph: SpreadsheetGraph,
  args: {
    daysOverdueCol: string; // e.g. "C"
    loanBalanceCol: string; // e.g. "D"
    provisionCol: string; // e.g. "E"
    startRow: number;
    endRow: number;
    sheet?: string;
  },
  rationale: string
): ToolResult {
  const sheetName = args.sheet ?? graph.activeSheet;
  const operations: CellOperation[] = [];
  const links: CellLink[] = [];

  for (let row = args.startRow; row <= args.endRow; row++) {
    const daysAddr = `${args.daysOverdueCol}${row}`;
    const balanceAddr = `${args.loanBalanceCol}${row}`;
    const provisionAddr = `${args.provisionCol}${row}`;

    const daysCell = getCell(graph, daysAddr, sheetName);
    if (!daysCell || daysCell.type === "empty") continue;

    const daysOverdue = Number(daysCell.value);
    const rate = sasraProvisionRate(daysOverdue);
    const label = sasraProvisionLabel(daysOverdue);

    // Formula: =loan_balance * provision_rate
    const formula = `=${balanceAddr}*${rate}`;

    const { old, updated } = proposeWrite(
      graph, provisionAddr, null, formula, sheetName
    );

    const dependents = findDependents(graph, provisionAddr, sheetName);

    const op: CellOperation = {
      id: newOpId(),
      tool: "apply_sasra_provisioning",
      address: provisionAddr.toUpperCase(),
      sheet: sheetName,
      oldValue: old?.value ?? null,
      oldFormula: old?.formula ?? null,
      newValue: null,
      newFormula: formula,
      rationale: `SASRA Form 4: ${daysOverdue} days overdue → ${label} classification → ${(rate * 100).toFixed(0)}% provision rate`,
      affectedBy: dependents.map((c) => c.address),
      status: "pending",
      timestamp: new Date(),
    };

    operations.push(op);
    links.push(makeCellLink(updated, `${label}: ${(rate * 100).toFixed(0)}% of ${balanceAddr}`));
  }

  return {
    success: true,
    operations,
    message: `Proposed SASRA provisioning formulas for ${operations.length} rows (${args.startRow}–${args.endRow}). Review each change before accepting.`,
    cellLinks: links,
  };
}

/**
 * TOOL: detect_ghost_accounts
 * Compares member ID column against a known-good members list (passed as context).
 * Flags any cell whose member ID has no corresponding entry.
 *
 * This is analyzeForensics() ghost detection re-expressed as cell flags.
 */
function tool_detect_ghost_accounts(
  graph: SpreadsheetGraph,
  args: {
    memberIdCol: string; // e.g. "A"
    startRow: number;
    endRow: number;
    validMemberIds: string[]; // list from authoritative register
    sheet?: string;
  },
  rationale: string
): ToolResult {
  const sheetName = args.sheet ?? graph.activeSheet;
  const operations: CellOperation[] = [];
  const links: CellLink[] = [];
  let ghostCount = 0;

  const validSet = new Set(args.validMemberIds.map((id) => String(id).trim()));

  for (let row = args.startRow; row <= args.endRow; row++) {
    const addr = `${args.memberIdCol}${row}`;
    const cell = getCell(graph, addr, sheetName);
    if (!cell || cell.type === "empty") continue;

    const memberId = String(cell.value).trim();
    if (!validSet.has(memberId)) {
      // flag_cell is applied directly (no approval needed for flags)
      const sheetGraph = graph.sheets.get(sheetName)!;
      const liveCell = sheetGraph.cells.get(addr.toUpperCase())!;
      liveCell.flagged = "ghost_account";
      liveCell.flagRationale = `Member ID "${memberId}" not found in authoritative register`;
      sheetGraph.cells.set(addr.toUpperCase(), liveCell);

      links.push(
        makeCellLink(
          liveCell,
          `Ghost account: ID "${memberId}" not in register`
        )
      );
      ghostCount++;
    }
  }

  return {
    success: true,
    operations,
    message:
      ghostCount > 0
        ? `⚠ Detected ${ghostCount} ghost account(s). Flagged cells are highlighted — click to inspect.`
        : `✓ No ghost accounts found. All ${args.endRow - args.startRow + 1} member IDs verified.`,
    cellLinks: links,
  };
}

/**
 * TOOL: detect_phantom_savings
 * Compares recorded savings balance against actual inflows.
 * Flags cells where recorded_savings > actual_inflow by more than tolerance.
 */
function tool_detect_phantom_savings(
  graph: SpreadsheetGraph,
  args: {
    recordedSavingsCol: string; // e.g. "C"
    actualInflowCol: string; // e.g. "D"
    startRow: number;
    endRow: number;
    toleranceKES?: number; // default 0
    sheet?: string;
  },
  rationale: string
): ToolResult {
  const sheetName = args.sheet ?? graph.activeSheet;
  const links: CellLink[] = [];
  const tolerance = args.toleranceKES ?? 0;
  let phantomCount = 0;

  for (let row = args.startRow; row <= args.endRow; row++) {
    const savedAddr = `${args.recordedSavingsCol}${row}`;
    const inflowAddr = `${args.actualInflowCol}${row}`;

    const savedCell = getCell(graph, savedAddr, sheetName);
    const inflowCell = getCell(graph, inflowAddr, sheetName);

    if (!savedCell || !inflowCell) continue;

    const recorded = Number(savedCell.value ?? 0);
    const actual = Number(inflowCell.value ?? 0);

    if (recorded - actual > tolerance) {
      const sheetGraph = graph.sheets.get(sheetName)!;
      const liveCell = sheetGraph.cells.get(savedAddr.toUpperCase())!;
      liveCell.flagged = "phantom_savings";
      liveCell.flagRationale = `Recorded KES ${recorded.toLocaleString()} but actual inflow KES ${actual.toLocaleString()} — discrepancy KES ${(recorded - actual).toLocaleString()}`;
      sheetGraph.cells.set(savedAddr.toUpperCase(), liveCell);

      links.push(
        makeCellLink(
          liveCell,
          `Phantom savings: KES ${(recorded - actual).toLocaleString()} unaccounted`
        )
      );
      phantomCount++;
    }
  }

  return {
    success: true,
    operations: [],
    message:
      phantomCount > 0
        ? `⚠ Detected ${phantomCount} phantom savings case(s). Discrepancies flagged.`
        : `✓ Savings balances reconcile within KES ${tolerance.toLocaleString()} tolerance.`,
    cellLinks: links,
  };
}

/**
 * TOOL: normalize_phone_column
 * Standardises all phone numbers in a column to 254XXXXXXXXX format.
 * Proposes write_value operations for each non-conforming cell.
 */
function tool_normalize_phone_column(
  graph: SpreadsheetGraph,
  args: { col: string; startRow: number; endRow: number; sheet?: string },
  rationale: string
): ToolResult {
  const sheetName = args.sheet ?? graph.activeSheet;
  const operations: CellOperation[] = [];
  const links: CellLink[] = [];

  for (let row = args.startRow; row <= args.endRow; row++) {
    const addr = `${args.col}${row}`;
    const cell = getCell(graph, addr, sheetName);
    if (!cell || cell.type === "empty") continue;

    const raw = String(cell.value);
    const normalized = normalizePhone(raw);

    if (normalized !== raw) {
      const { old, updated } = proposeWrite(
        graph, addr, normalized, null, sheetName
      );

      const op: CellOperation = {
        id: newOpId(),
        tool: "normalize_phone_column",
        address: addr.toUpperCase(),
        sheet: sheetName,
        oldValue: raw,
        oldFormula: null,
        newValue: normalized,
        newFormula: null,
        rationale: `Normalised phone from "${raw}" → "${normalized}" (Kenyan 254 format)`,
        affectedBy: [],
        status: "pending",
        timestamp: new Date(),
      };

      operations.push(op);
      links.push(makeCellLink(updated, `${raw} → ${normalized}`));
    }
  }

  return {
    success: true,
    operations,
    message:
      operations.length > 0
        ? `Proposed ${operations.length} phone number normalisation(s). Review before accepting.`
        : `✓ All phone numbers in column ${args.col} already in 254 format.`,
    cellLinks: links,
  };
}

// ── Tool registry & dispatcher ────────────────────────────────────────────────

export type ToolName =
  | "read_cell"
  | "write_formula"
  | "write_value"
  | "flag_cell"
  | "tag_cell"
  | "apply_sasra_provisioning"
  | "detect_ghost_accounts"
  | "detect_phantom_savings"
  | "normalize_phone_column";

/**
 * Tool definitions sent to the LLM as its tool schema.
 * The LLM reads these and decides which tool to call.
 */
export const TOOL_DEFINITIONS = [
  {
    name: "read_cell",
    description: "Read the current value and formula at a cell address before proposing changes.",
    parameters: {
      address: { type: "string", description: "Cell address e.g. D7" },
      sheet: { type: "string", description: "Sheet name (optional, defaults to active sheet)" },
    },
  },
  {
    name: "write_formula",
    description: "Propose writing an Excel formula to a specific cell. Goes into pending state for user approval.",
    parameters: {
      address: { type: "string", description: "Target cell e.g. E12" },
      formula: { type: "string", description: "Excel formula starting with = e.g. =C12*0.25" },
      sheet: { type: "string", description: "Sheet name (optional)" },
    },
  },
  {
    name: "write_value",
    description: "Propose writing a plain value (not a formula) to a cell. Goes into pending state for user approval.",
    parameters: {
      address: { type: "string" },
      value: { type: "string | number" },
      sheet: { type: "string", description: "Optional" },
    },
  },
  {
    name: "flag_cell",
    description: "Flag a cell with a SACCO compliance or fraud marker. Does not change the value — only annotates.",
    parameters: {
      address: { type: "string" },
      flag: { type: "string", enum: ["ghost_account", "phantom_savings", "unremitted_deduction", "compliance_breach", "data_anomaly"] },
      sheet: { type: "string", description: "Optional" },
    },
  },
  {
    name: "tag_cell",
    description: "Tag a cell with a SACCO semantic role e.g. loan_balance, member_id.",
    parameters: {
      address: { type: "string" },
      tag: { type: "string", enum: ["member_id", "member_name", "phone", "loan_balance", "loan_days_overdue", "provision_rate", "provision_amount", "savings_balance", "dividend", "share_capital"] },
      sheet: { type: "string", description: "Optional" },
    },
  },
  {
    name: "apply_sasra_provisioning",
    description: "Apply SASRA Form 4 provisioning rules across a row range. Proposes formulas based on days overdue.",
    parameters: {
      daysOverdueCol: { type: "string", description: "Column letter with days overdue values" },
      loanBalanceCol: { type: "string", description: "Column letter with loan balance values" },
      provisionCol: { type: "string", description: "Target column for provisioning formulas" },
      startRow: { type: "number" },
      endRow: { type: "number" },
      sheet: { type: "string", description: "Optional" },
    },
  },
  {
    name: "detect_ghost_accounts",
    description: "Compare member ID column against authoritative register. Flag rows whose ID is not in the register.",
    parameters: {
      memberIdCol: { type: "string" },
      startRow: { type: "number" },
      endRow: { type: "number" },
      validMemberIds: { type: "array", items: { type: "string" } },
      sheet: { type: "string", description: "Optional" },
    },
  },
  {
    name: "detect_phantom_savings",
    description: "Compare recorded savings against actual inflows. Flag rows where recorded > actual by more than tolerance.",
    parameters: {
      recordedSavingsCol: { type: "string" },
      actualInflowCol: { type: "string" },
      startRow: { type: "number" },
      endRow: { type: "number" },
      toleranceKES: { type: "number", description: "Acceptable discrepancy in KES (default 0)" },
      sheet: { type: "string", description: "Optional" },
    },
  },
  {
    name: "normalize_phone_column",
    description: "Standardise all phone numbers in a column to Kenyan 254XXXXXXXXX format.",
    parameters: {
      col: { type: "string" },
      startRow: { type: "number" },
      endRow: { type: "number" },
      sheet: { type: "string", description: "Optional" },
    },
  },
];

/**
 * Dispatch a tool call from the LLM to the right function.
 * This is the single entry point — the LLM emits a ToolCall,
 * this function runs it and returns a ToolResult.
 */
export function dispatchTool(
  graph: SpreadsheetGraph,
  call: ToolCall
): ToolResult {
  const { tool, args, rationale } = call;

  switch (tool as ToolName) {
    case "read_cell":
      return tool_read_cell(graph, args as any, rationale);
    case "write_formula":
      return tool_write_formula(graph, args as any, rationale);
    case "write_value":
      return tool_write_value(graph, args as any, rationale);
    case "flag_cell":
      return tool_flag_cell(graph, args as any, rationale);
    case "tag_cell":
      return tool_tag_cell(graph, args as any, rationale);
    case "apply_sasra_provisioning":
      return tool_apply_sasra_provisioning(graph, args as any, rationale);
    case "detect_ghost_accounts":
      return tool_detect_ghost_accounts(graph, args as any, rationale);
    case "detect_phantom_savings":
      return tool_detect_phantom_savings(graph, args as any, rationale);
    case "normalize_phone_column":
      return tool_normalize_phone_column(graph, args as any, rationale);
    default:
      return {
        success: false,
        operations: [],
        message: `Unknown tool: "${tool}"`,
        cellLinks: [],
      };
  }
}
