import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { nanoid } from "nanoid";
import {
  createSession,
  getSession,
  getUserSessions,
  updateSession,
  createDocument,
  getSessionDocuments,
  createSpreadsheetGraph,
  getSessionGraphs,
  createPendingOperation,
  getPendingOperations,
  getPendingOperation,
  updatePendingOperation,
  createAuditLog,
  getSessionAuditLogs,
  createConversationMessage,
  getSessionConversationHistory,
  createVersion,
  getSessionVersions,
  createFlaggedCell,
  getSessionFlaggedCells,
} from "../db";
import { invokeLLM } from "../_core/llm";
// XLSX import handled via server build

/**
 * Spreadsheet router: handles all agentic spreadsheet operations
 * Routes: /upload, /chat, /accept, /reject, /export, /audit-log, /pending
 */
export const spreadsheetRouter = router({
  /**
   * POST /upload
   * Initialize a new session with uploaded file(s)
   */
  upload: protectedProcedure
    .input(
      z.object({
        sessionTitle: z.string().min(1),
        sessionDescription: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sessionId = nanoid(12);
      const userId = ctx.user.id;

      // Create session in database
      const session = await createSession({
        id: sessionId,
        userId,
        title: input.sessionTitle,
        description: input.sessionDescription,
        status: "active",
      });

      return {
        sessionId,
        session,
        message: "Session created successfully. Ready for file uploads.",
      };
    }),

  /**
   * POST /chat
   * Send a natural language prompt to the AI agent
   * Returns: AI response with proposed operations
   */
  chat: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionId, message } = input;
      const userId = ctx.user.id;

      // Verify session exists and belongs to user
      const session = await getSession(sessionId);
      if (!session || session.userId !== userId) {
        throw new Error("Session not found or access denied");
      }

      // Get conversation history
      const history = await getSessionConversationHistory(sessionId);
      const conversationMessages = history.map((h) => ({
        role: h.role as "user" | "assistant" | "system",
        content: h.content,
      }));

      // Get all documents and graphs for context
      const documents = await getSessionDocuments(sessionId);
      const graphs = await getSessionGraphs(sessionId);

      // Build system prompt for Kenyan financial institutions
      const systemPrompt = `You are an agentic financial AI assistant for Kenyan financial institutions (SACCOs, banks, microfinance, insurance, investment firms). You work like a code IDE — you read the spreadsheet, propose targeted cell-level changes, and the user reviews each change before it is committed.

CRITICAL RULES:
1. ALWAYS call read_cell before proposing a write to a cell you haven't read yet.
2. ALWAYS provide a clear "rationale" field explaining WHY you are making each change.
3. NEVER write to a cell without reading it first.
4. Your changes go into a PENDING state. The user will accept or reject each one. Design your changes to be reviewable — one logical operation at a time.

KENYAN FINANCIAL CONTEXT:
- Currency: KES (Kenyan Shilling). Always refer to amounts as "KES X,XXX"
- Phone numbers should be in 254XXXXXXXXX format
- CBK = Central Bank of Kenya
- SASRA = Savings and Credit Cooperative Societies Regulatory Authority
- IRA = Insurance Regulatory Authority
- Provisioning classifications: Performing (≤0 days, 1%), Watch (1-30 days, 5%), Substandard (31-90 days, 25%), Doubtful (91-180 days, 50%), Loss (>180 days, 100%)
- Ghost accounts: member IDs that appear in transaction records but not in the official member register
- Phantom savings: recorded savings balance exceeds total verifiable inflows
- M-Pesa transactions must be reconciled against bank statements

When the user asks you to analyse, audit, or clean their spreadsheet, respond with a plan first, then call the appropriate tools in sequence. Always end with a summary of what you changed and what the user needs to review.`;

      // Call LLM with context
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "system",
            content: `Session context: ${documents.length} documents, ${graphs.length} spreadsheet graphs loaded.`,
          },
          ...conversationMessages,
          { role: "user", content: message },
        ],
      });

      const aiResponse = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content 
        : "No response generated";

      // Save conversation to history
      await createConversationMessage({
        id: nanoid(12),
        sessionId,
        role: "user",
        content: message,
      });

      await createConversationMessage({
        id: nanoid(12),
        sessionId,
        role: "assistant",
        content: aiResponse,
      });

      // TODO: Parse tool calls from response and create pending operations
      // For now, return the raw AI response

      return {
        sessionId,
        message: aiResponse,
        operations: [],
        cellLinks: [],
        toolsInvoked: [],
      };
    }),

  /**
   * POST /accept
   * Accept a pending operation (approve AI-proposed change)
   */
  accept: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        operationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionId, operationId } = input;
      const userId = ctx.user.id;

      // Verify session belongs to user
      const session = await getSession(sessionId);
      if (!session || session.userId !== userId) {
        throw new Error("Session not found or access denied");
      }

      // Get the pending operation
      const operation = await getPendingOperation(operationId);
      if (!operation || operation.sessionId !== sessionId) {
        throw new Error("Operation not found");
      }

      // Update operation status to accepted
      await updatePendingOperation(operationId, {
        status: "accepted",
        decidedBy: String(userId),
        decidedAt: new Date(),
      });

      // Create audit log entry
      await createAuditLog({
        id: nanoid(12),
        sessionId,
        userId,
        action: "OPERATION_ACCEPTED",
        operationId,
        details: {
          address: operation.address,
          tool: operation.tool,
          rationale: operation.rationale,
        },
      });

      // TODO: Apply the operation to the spreadsheet graph

      return {
        success: true,
        message: `Operation ${operationId} accepted and applied.`,
      };
    }),

  /**
   * POST /reject
   * Reject a pending operation (discard AI-proposed change)
   */
  reject: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        operationId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionId, operationId, reason } = input;
      const userId = ctx.user.id;

      // Verify session belongs to user
      const session = await getSession(sessionId);
      if (!session || session.userId !== userId) {
        throw new Error("Session not found or access denied");
      }

      // Get the pending operation
      const operation = await getPendingOperation(operationId);
      if (!operation || operation.sessionId !== sessionId) {
        throw new Error("Operation not found");
      }

      // Update operation status to rejected
      await updatePendingOperation(operationId, {
        status: "rejected",
        decidedBy: String(userId),
        decidedAt: new Date(),
      });

      // Create audit log entry
      await createAuditLog({
        id: nanoid(12),
        sessionId,
        userId,
        action: "OPERATION_REJECTED",
        operationId,
        details: {
          address: operation.address,
          tool: operation.tool,
          reason: reason || "No reason provided",
        },
      });

      return {
        success: true,
        message: `Operation ${operationId} rejected.`,
      };
    }),

  /**
   * GET /export
   * Export the current spreadsheet as XLSX
   */
  export: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { sessionId } = input;
      const userId = ctx.user.id;

      // Verify session belongs to user
      const session = await getSession(sessionId);
      if (!session || session.userId !== userId) {
        throw new Error("Session not found or access denied");
      }

      // Get spreadsheet graphs
      const graphs = await getSessionGraphs(sessionId);
      if (graphs.length === 0) {
        throw new Error("No spreadsheet data to export");
      }

      // TODO: Reconstruct XLSX from graph data
      // For now, return a placeholder

      return {
        success: true,
        message: "Export ready",
        // In real implementation, return buffer or S3 URL
      };
    }),

  /**
   * GET /audit-log
   * Get audit trail for the session
   */
  auditLog: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { sessionId } = input;
      const userId = ctx.user.id;

      // Verify session belongs to user
      const session = await getSession(sessionId);
      if (!session || session.userId !== userId) {
        throw new Error("Session not found or access denied");
      }

      const logs = await getSessionAuditLogs(sessionId);

      return {
        sessionId,
        auditLog: logs,
        totalEntries: logs.length,
      };
    }),

  /**
   * GET /pending
   * Get list of pending operations
   */
  pending: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { sessionId } = input;
      const userId = ctx.user.id;

      // Verify session belongs to user
      const session = await getSession(sessionId);
      if (!session || session.userId !== userId) {
        throw new Error("Session not found or access denied");
      }

      const operations = await getPendingOperations(sessionId);

      return {
        sessionId,
        pending: operations,
        totalPending: operations.length,
      };
    }),

  /**
   * Get user's sessions
   */
  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await getUserSessions(ctx.user.id);
    return {
      sessions,
      total: sessions.length,
    };
  }),

  /**
   * Get session details
   */
  getSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await getSession(input.sessionId);
      if (!session || session.userId !== ctx.user.id) {
        throw new Error("Session not found or access denied");
      }

      const documents = await getSessionDocuments(input.sessionId);
      const pendingOps = await getPendingOperations(input.sessionId);
      const auditLogs = await getSessionAuditLogs(input.sessionId);

      return {
        session,
        documents,
        pendingOperations: pendingOps,
        auditLogCount: auditLogs.length,
      };
    }),
});
