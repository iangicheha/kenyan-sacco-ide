/**
 * semantic_engine.ts
 *
 * The main orchestrator — this is what your Express routes call.
 *
 * Flow:
 *   1. User uploads a file → parseSpreadsheet() builds the cell graph
 *   2. User sends a prompt → runAgentTurn() sends it to Groq with
 *      the spreadsheet context + tool definitions
 *   3. Groq returns tool calls → dispatchTool() executes each one
 *   4. Results land in DiffStore as PENDING operations
 *   5. Frontend shows the diff → user accepts/rejects per cell
 *   6. Accepted operations are committed to the graph
 *   7. User downloads → exportToBuffer() writes the final xlsx
 *
 * This replaces the old semantic_engine.ts entirely.
 * Your SACCO logic (provisioning, forensics, phone normalisation)
 * is preserved — it now lives in tool_registry.ts as typed tools.
 */

import Groq from "groq-sdk";
import {
  SpreadsheetGraph,
  parseSpreadsheet,
  serializeForLLM,
  exportToBuffer,
} from "./cell_graph";
import {
  dispatchTool,
  TOOL_DEFINITIONS,
  ToolCall,
  ToolResult,
} from "./tool_registry";
import {
  DiffStore,
  getOrCreateSession,
  clearSession,
} from "./diff_store";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Session state ─────────────────────────────────────────────────────────────

interface Session {
  graph: SpreadsheetGraph;
  diffStore: DiffStore;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

const activeSessions: Map<string, Session> = new Map();

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an agentic financial AI assistant for Kenyan SACCOs (Savings and Credit Cooperative Organisations). You work like a code IDE — you read the spreadsheet, propose targeted cell-level changes, and the user reviews each change before it is committed.

CRITICAL RULES:
1. ALWAYS call read_cell before proposing a write to a cell you haven't read yet.
2. ALWAYS provide a clear "rationale" field explaining WHY you are making each change.
3. NEVER write to a cell without reading it first.
4. When running SASRA compliance (Form 4 provisioning), use apply_sasra_provisioning — do not write formulas manually row by row.
5. For forensic checks, call detect_ghost_accounts or detect_phantom_savings — these flag cells but do NOT change values.
6. Your changes go into a PENDING state. The user will accept or reject each one. Design your changes to be reviewable — one logical operation at a time.

KENYAN SACCO CONTEXT:
- Currency: KES (Kenyan Shilling). Always refer to amounts as "KES X,XXX"
- Phone numbers should be in 254XXXXXXXXX format
- SASRA = Savings and Credit Cooperative Societies Regulatory Authority
- Provisioning classifications: Performing (≤0 days, 1%), Watch (1-30 days, 5%), Substandard (31-90 days, 25%), Doubtful (91-180 days, 50%), Loss (>180 days, 100%)
- Ghost accounts: member IDs that appear in transaction records but not in the official member register
- Phantom savings: recorded savings balance exceeds total verifiable inflows

When the user asks you to analyse, audit, or clean their spreadsheet, respond with a plan first, then call the appropriate tools in sequence. Always end with a summary of what you changed and what the user needs to review.`;

// ── File upload ───────────────────────────────────────────────────────────────

/**
 * Called when a file is uploaded.
 * Parses it into a cell graph and initialises the session.
 */
export function initSession(
  sessionId: string,
  buffer: Buffer,
  fileName: string
): {
  sessionId: string;
  sheets: string[];
  activeSheet: string;
  rowCount: number;
  colCount: number;
  preview: string; // first 10 rows serialised for display
} {
  const graph = parseSpreadsheet(buffer, fileName);
  const diffStore = getOrCreateSession(sessionId);

  activeSessions.set(sessionId, {
    graph,
    diffStore,
    conversationHistory: [],
  });

  const activeSheetGraph = graph.sheets.get(graph.activeSheet)!;

  // Generate a preview of the first 10 rows for the frontend grid
  const maxPreviewRow = Math.min(10, activeSheetGraph.rowCount);
  const lastCol = colNumberToLetter(activeSheetGraph.colCount);
  const preview = serializeForLLM(graph, `A1`, `${lastCol}${maxPreviewRow}`);

  return {
    sessionId,
    sheets: Array.from(graph.sheets.keys()),
    activeSheet: graph.activeSheet,
    rowCount: activeSheetGraph.rowCount,
    colCount: activeSheetGraph.colCount,
    preview,
  };
}

// ── Agent turn ────────────────────────────────────────────────────────────────

export interface AgentTurnResult {
  message: string; // what the AI said in natural language
  operations: import("./tool_registry").CellOperation[]; // pending cell changes
  cellLinks: import("./tool_registry").CellLink[]; // clickable cell refs
  toolsInvoked: string[]; // list of tool names called this turn
}

/**
 * Run one turn of the agent loop.
 * The LLM may call multiple tools in sequence before responding.
 */
export async function runAgentTurn(
  sessionId: string,
  userMessage: string
): Promise<AgentTurnResult> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session "${sessionId}" not found. Please upload a file first.`);
  }

  const { graph, diffStore, conversationHistory } = session;
  const activeSheetGraph = graph.sheets.get(graph.activeSheet)!;

  // Serialise a context snapshot of the spreadsheet for the LLM
  // Keep it to first 50 rows to stay within token limits
  const maxContextRow = Math.min(50, activeSheetGraph.rowCount);
  const lastCol = colNumberToLetter(activeSheetGraph.colCount);
  const spreadsheetContext = serializeForLLM(
    graph, "A1", `${lastCol}${maxContextRow}`
  );

  // Build the messages array
  const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `CURRENT SPREADSHEET (${graph.fileName}, sheet: ${graph.activeSheet}, ${activeSheetGraph.rowCount} rows × ${activeSheetGraph.colCount} cols):\n\n${spreadsheetContext}`,
    },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  const allOperations: import("./tool_registry").CellOperation[] = [];
  const allCellLinks: import("./tool_registry").CellLink[] = [];
  const toolsInvoked: string[] = [];
  const readAddresses = new Set<string>();
  let finalMessage = "";

  const hasReadCoverage = (col: string, startRow: number, endRow: number): boolean => {
    const upperCol = String(col ?? "").trim().toUpperCase();
    if (!/^[A-Z]{1,3}$/.test(upperCol)) return false;
    if (!Number.isInteger(startRow) || !Number.isInteger(endRow) || startRow > endRow) {
      return false;
    }
    for (let row = startRow; row <= endRow; row++) {
      if (!readAddresses.has(`${upperCol}${row}`)) return false;
    }
    return true;
  };

  const explainMissingReads = (
    col: string,
    startRow: number,
    endRow: number
  ): string[] => {
    const upperCol = String(col ?? "").trim().toUpperCase();
    const missing: string[] = [];
    for (let row = startRow; row <= endRow; row++) {
      const addr = `${upperCol}${row}`;
      if (!readAddresses.has(addr)) missing.push(addr);
      if (missing.length >= 5) break;
    }
    return missing;
  };

  // Agentic loop — the LLM can call multiple tools before giving a final response
  let iterations = 0;
  const MAX_ITERATIONS = 10; // safety cap

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Call Groq — pass tool definitions as structured JSON in the system prompt
    // (Groq Llama-3.3-70B supports function calling via the tools parameter)
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: messages as any,
      tools: TOOL_DEFINITIONS.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: "object",
            properties: {
              ...t.parameters,
              rationale: {
                type: "string",
                description: "Explain why you are calling this tool",
              },
            },
            required: ["rationale"],
          },
        },
      })),
      tool_choice: "auto",
      max_tokens: 2048,
      temperature: 0.1, // low temperature for deterministic financial outputs
    });

    const choice = response.choices[0];

    // If no tool calls — the LLM is done, extract final message
    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      finalMessage = choice.message.content ?? "";
      conversationHistory.push({ role: "user", content: userMessage });
      conversationHistory.push({ role: "assistant", content: finalMessage });
      break;
    }

    // Execute each tool call
    const toolResults: string[] = [];

    for (const toolCall of choice.message.tool_calls) {
      const fnName = toolCall.function.name;
      let args: Record<string, unknown> = {};

      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        toolResults.push(`Error parsing args for ${fnName}`);
        continue;
      }

      const call: ToolCall = {
        tool: fnName,
        args,
        rationale: (args.rationale as string) ?? "",
      };

      // Guardrail: direct writes require read_cell first in same turn.
      if (
        (fnName === "write_formula" || fnName === "write_value") &&
        typeof args.address === "string"
      ) {
        const upper = String(args.address).toUpperCase();
        if (!readAddresses.has(upper)) {
          toolResults.push(
            `Guardrail blocked ${fnName}(${upper}): call read_cell first.`
          );
          continue;
        }
      }

      // Guardrail: batch writes require read coverage for relevant ranges.
      if (fnName === "normalize_phone_column") {
        const col = String(args.col ?? "").toUpperCase();
        const startRow = Number(args.startRow);
        const endRow = Number(args.endRow);
        if (!hasReadCoverage(col, startRow, endRow)) {
          const missing = explainMissingReads(col, startRow, endRow);
          toolResults.push(
            `Guardrail blocked normalize_phone_column(${col}${startRow}:${col}${endRow}): missing read coverage (e.g. ${missing.join(", ")}).`
          );
          continue;
        }
      }

      if (fnName === "apply_sasra_provisioning") {
        const daysCol = String(args.daysOverdueCol ?? "").toUpperCase();
        const balanceCol = String(args.loanBalanceCol ?? "").toUpperCase();
        const startRow = Number(args.startRow);
        const endRow = Number(args.endRow);

        const hasDaysReads = hasReadCoverage(daysCol, startRow, endRow);
        const hasBalanceReads = hasReadCoverage(balanceCol, startRow, endRow);
        if (!hasDaysReads || !hasBalanceReads) {
          const missingDays = hasDaysReads
            ? []
            : explainMissingReads(daysCol, startRow, endRow);
          const missingBalance = hasBalanceReads
            ? []
            : explainMissingReads(balanceCol, startRow, endRow);
          toolResults.push(
            `Guardrail blocked apply_sasra_provisioning(${startRow}-${endRow}): read ${daysCol} and ${balanceCol} first (missing examples: ${[
              ...missingDays,
              ...missingBalance,
            ].join(", ")}).`
          );
          continue;
        }
      }

      const result: ToolResult = dispatchTool(graph, call);
      toolsInvoked.push(fnName);

      if (fnName === "read_cell" && typeof args.address === "string") {
        readAddresses.add(String(args.address).toUpperCase());
      }

      // Stage pending operations in the diff store
      if (result.operations.length > 0) {
        diffStore.addOperations(result.operations);
        allOperations.push(...result.operations);
      }

      allCellLinks.push(...result.cellLinks);
      toolResults.push(result.message);
    }

    // Feed tool results back to the LLM for the next iteration
    messages.push({
      role: "assistant" as any,
      content: choice.message.content ?? "",
    });
    messages.push({
      role: "user",
      content: `Tool results:\n${toolResults.join("\n")}`,
    });
  }

  if (!finalMessage) {
    finalMessage = "Analysis complete. Please review the proposed changes in the diff panel.";
  }

  return {
    message: finalMessage,
    operations: allOperations,
    cellLinks: allCellLinks,
    toolsInvoked,
  };
}

// ── Accept / Reject passthrough ───────────────────────────────────────────────

export function acceptOperation(
  sessionId: string,
  operationId: string
): { success: boolean; message: string } {
  const session = activeSessions.get(sessionId);
  if (!session) return { success: false, message: "Session not found." };
  return session.diffStore.accept(session.graph, operationId);
}

export function rejectOperation(
  sessionId: string,
  operationId: string
): { success: boolean; message: string } {
  const session = activeSessions.get(sessionId);
  if (!session) return { success: false, message: "Session not found." };
  return session.diffStore.reject(session.graph, operationId);
}

export function acceptAll(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return { accepted: 0, messages: [] };
  return session.diffStore.acceptAll(session.graph);
}

export function rejectAll(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return { rejected: 0, messages: [] };
  return session.diffStore.rejectAll(session.graph);
}

// ── Export ────────────────────────────────────────────────────────────────────

export function exportSession(sessionId: string): Buffer {
  const session = activeSessions.get(sessionId);
  if (!session) throw new Error("Session not found.");
  return exportToBuffer(session.graph);
}

export function getAuditLog(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return [];
  return session.diffStore.exportAuditLog();
}

export function getPendingOperations(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return [];
  return session.diffStore.getPending();
}

export function getCellHistory(sessionId: string, address: string, sheet?: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return [];
  return session.diffStore.getCellHistory(address, sheet);
}

export function getSessionSummary(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return null;
  return session.diffStore.getSummary();
}

export function endSession(sessionId: string): void {
  activeSessions.delete(sessionId);
  clearSession(sessionId);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function colNumberToLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
