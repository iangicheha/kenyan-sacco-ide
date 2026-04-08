/**
 * diff_store.ts
 *
 * The accept/reject layer — the thing that makes this feel like
 * a code IDE instead of an AI that silently rewrites your file.
 *
 * When a tool proposes a cell change, it lands here as PENDING.
 * The frontend shows the diff (old value vs new formula/value).
 * The user clicks Accept or Reject per operation.
 * Only accepted operations are committed to the cell graph.
 *
 * Every operation — accepted OR rejected — is written to the
 * audit log with its full rationale. SASRA auditors can query
 * this log: "why did provision in D47 change on 3 April 2025?"
 */

import {
  SpreadsheetGraph,
  commitWrite,
  rejectWrite,
} from "./cell_graph";
import { CellOperation } from "./tool_registry";

// ── Audit log entry ───────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  sessionId: string;
  operationId: string;
  tool: string;
  address: string;
  sheet: string;
  oldValue: string | number | boolean | null;
  oldFormula: string | null;
  newValue: string | number | boolean | null;
  newFormula: string | null;
  rationale: string;
  decision: "accepted" | "rejected";
  decidedAt: Date;
  decidedBy: string; // user identifier
}

// ── Diff store ────────────────────────────────────────────────────────────────

export class DiffStore {
  private pending: Map<string, CellOperation> = new Map();
  private auditLog: AuditEntry[] = [];
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  // ── Intake ──────────────────────────────────────────────────────────────────

  /**
   * Add one or more pending operations from a tool result.
   * Called automatically after dispatchTool().
   */
  addOperations(operations: CellOperation[]): void {
    for (const op of operations) {
      this.pending.set(op.id, { ...op, status: "pending" });
    }
  }

  /**
   * Get all pending operations — sent to the frontend to render the diff UI.
   */
  getPending(): CellOperation[] {
    return Array.from(this.pending.values()).filter(
      (op) => op.status === "pending"
    );
  }

  /**
   * Get a single pending operation by ID.
   */
  getOperation(id: string): CellOperation | undefined {
    return this.pending.get(id);
  }

  // ── Accept / Reject ─────────────────────────────────────────────────────────

  /**
   * Accept a pending operation.
   * Commits the staged cell in the graph and writes to audit log.
   */
  accept(
    graph: SpreadsheetGraph,
    operationId: string,
    decidedBy: string = "user"
  ): { success: boolean; message: string } {
    const op = this.pending.get(operationId);
    if (!op) {
      return { success: false, message: `Operation ${operationId} not found.` };
    }
    if (op.status !== "pending") {
      return { success: false, message: `Operation ${operationId} already ${op.status}.` };
    }

    // Commit the staged write to the live cell graph
    commitWrite(graph, op.address, op.sheet);

    // Update status
    op.status = "accepted";
    this.pending.set(operationId, op);

    // Write to audit log
    this.auditLog.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sessionId: this.sessionId,
      operationId: op.id,
      tool: op.tool,
      address: op.address,
      sheet: op.sheet,
      oldValue: op.oldValue,
      oldFormula: op.oldFormula,
      newValue: op.newValue,
      newFormula: op.newFormula,
      rationale: op.rationale,
      decision: "accepted",
      decidedAt: new Date(),
      decidedBy,
    });

    const display = op.newFormula ?? op.newValue;
    return {
      success: true,
      message: `✓ Accepted: [${op.address}] → \`${display}\``,
    };
  }

  /**
   * Accept ALL pending operations at once.
   * "Accept all" button in the frontend.
   */
  acceptAll(
    graph: SpreadsheetGraph,
    decidedBy: string = "user"
  ): { accepted: number; messages: string[] } {
    const pending = this.getPending();
    const messages: string[] = [];

    for (const op of pending) {
      const result = this.accept(graph, op.id, decidedBy);
      messages.push(result.message);
    }

    return { accepted: pending.length, messages };
  }

  /**
   * Reject a pending operation.
   * Discards the staged cell, nothing in the graph changes.
   */
  reject(
    graph: SpreadsheetGraph,
    operationId: string,
    decidedBy: string = "user"
  ): { success: boolean; message: string } {
    const op = this.pending.get(operationId);
    if (!op) {
      return { success: false, message: `Operation ${operationId} not found.` };
    }
    if (op.status !== "pending") {
      return { success: false, message: `Operation ${operationId} already ${op.status}.` };
    }

    // Discard the staged write
    rejectWrite(graph, op.address, op.sheet);

    op.status = "rejected";
    this.pending.set(operationId, op);

    // Still write to audit log — rejections matter too
    this.auditLog.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sessionId: this.sessionId,
      operationId: op.id,
      tool: op.tool,
      address: op.address,
      sheet: op.sheet,
      oldValue: op.oldValue,
      oldFormula: op.oldFormula,
      newValue: op.newValue,
      newFormula: op.newFormula,
      rationale: op.rationale,
      decision: "rejected",
      decidedAt: new Date(),
      decidedBy,
    });

    return {
      success: true,
      message: `✗ Rejected: [${op.address}] — kept as \`${op.oldValue ?? op.oldFormula ?? "empty"}\``,
    };
  }

  /**
   * Reject ALL pending operations.
   */
  rejectAll(
    graph: SpreadsheetGraph,
    decidedBy: string = "user"
  ): { rejected: number; messages: string[] } {
    const pending = this.getPending();
    const messages: string[] = [];

    for (const op of pending) {
      const result = this.reject(graph, op.id, decidedBy);
      messages.push(result.message);
    }

    return { rejected: pending.length, messages };
  }

  // ── Audit log queries ───────────────────────────────────────────────────────

  /**
   * Get the full audit log — for the SASRA audit trail panel.
   */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  /**
   * Get audit log for a specific cell.
   * "Why did D47 change?" → show every operation that touched D47.
   */
  getCellHistory(address: string, sheet?: string): AuditEntry[] {
    const upper = address.toUpperCase();
    return this.auditLog.filter(
      (e) =>
        e.address === upper && (sheet ? e.sheet === sheet : true)
    );
  }

  /**
   * Get all audit entries for a specific tool.
   * e.g. "show me every provisioning change made this session"
   */
  getToolHistory(tool: string): AuditEntry[] {
    return this.auditLog.filter((e) => e.tool === tool);
  }

  /**
   * Serialize the audit log to a format suitable for PDF export
   * or SASRA Form submission.
   */
  exportAuditLog(): object[] {
    return this.auditLog.map((e) => ({
      "Operation ID": e.operationId,
      "Cell": `${e.sheet}!${e.address}`,
      "Tool": e.tool,
      "Old Value": e.oldFormula ?? e.oldValue ?? "(empty)",
      "New Value": e.newFormula ?? e.newValue ?? "(empty)",
      "Rationale": e.rationale,
      "Decision": e.decision.toUpperCase(),
      "Decided By": e.decidedBy,
      "Timestamp": e.decidedAt.toISOString(),
    }));
  }

  /**
   * Summary stats — used in the board report header.
   */
  getSummary(): {
    totalOperations: number;
    accepted: number;
    rejected: number;
    pending: number;
    cellsModified: string[];
  } {
    const all = Array.from(this.pending.values());
    const accepted = all.filter((o) => o.status === "accepted");
    const rejected = all.filter((o) => o.status === "rejected");
    const pending = all.filter((o) => o.status === "pending");

    const cellsModified = [
      ...new Set(accepted.map((o) => `${o.sheet}!${o.address}`)),
    ];

    return {
      totalOperations: all.length,
      accepted: accepted.length,
      rejected: rejected.length,
      pending: pending.length,
      cellsModified,
    };
  }
}

// ── Session manager ───────────────────────────────────────────────────────────

/**
 * One DiffStore per upload session.
 * Keyed by session ID so multiple SACCOs can work simultaneously.
 */
const sessions: Map<string, DiffStore> = new Map();

export function getOrCreateSession(sessionId: string): DiffStore {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new DiffStore(sessionId));
  }
  return sessions.get(sessionId)!;
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}
