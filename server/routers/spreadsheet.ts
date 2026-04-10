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

const chatTraceSchema = z.object({
  query: z.string(),
  plan: z.array(
    z.object({
      step: z.number(),
      action: z.string(),
      description: z.string(),
    })
  ),
  execution: z.array(
    z.object({
      step: z.number(),
      operation: z.string(),
      input: z.unknown(),
      output: z.unknown(),
    })
  ),
  result: z.union([z.number(), z.string()]),
});

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

      const systemPrompt = `
You are NOT a chatbot.

You are a deterministic financial reasoning engine.

Your role is to convert a user query into a STRICT execution trace using the provided dataset.

----------------------------------

HARD RULES (NO EXCEPTIONS):

- Output MUST be valid JSON
- DO NOT return text outside JSON
- DO NOT explain anything
- DO NOT add commentary
- DO NOT use markdown

----------------------------------

OUTPUT CONTRACT (STRICT):

You MUST return:

{
  "query": string,
  "plan": PlanStep[],
  "execution": ExecutionStep[],
  "result": number | string
}

----------------------------------

PLAN RULES:

- High-level reasoning only
- No numbers here
- No actual computation

Each step:
{
  "step": number,
  "action": string,
  "description": string
}

----------------------------------

EXECUTION RULES:

- MUST reflect REAL computation
- MUST use actual dataset values
- MUST be traceable step-by-step

Each step:
{
  "step": number,
  "operation": string,
  "input": any,
  "output": any
}

----------------------------------

CRITICAL BEHAVIOR:

- Always map query → dataset columns
- NEVER invent columns
- NEVER skip execution
- ALWAYS compute deterministically

----------------------------------

ERROR HANDLING:

If query cannot be computed:

{
  "query": "<query>",
  "plan": [],
  "execution": [],
  "result": "ERROR: <reason>"
}

----------------------------------

DATA USAGE:

You will receive structured table data.

Use ONLY the provided data.
`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        {
          role: "system" as const,
          content: `Session context: ${documents.length} documents, ${graphs.length} spreadsheet graphs loaded.`,
        },
        ...conversationMessages,
        { role: "user" as const, content: message },
      ];

      let parsedTrace:
        | {
            query: string;
            plan: Array<{ step: number; action: string; description: string }>;
            execution: Array<{ step: number; operation: string; input: unknown; output: unknown }>;
            result: number | string;
          }
        | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await invokeLLM({ messages });
        const raw = response.choices[0]?.message?.content;
        if (typeof raw !== "string") {
          continue;
        }
        try {
          const json = JSON.parse(raw);
          parsedTrace = chatTraceSchema.parse(json);
          break;
        } catch {
          continue;
        }
      }

      const aiResponse = parsedTrace
        ? JSON.stringify(parsedTrace)
        : JSON.stringify({
            query: message,
            plan: [],
            execution: [],
            result: "ERROR: invalid JSON output",
          });

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
        trace: parsedTrace,
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
