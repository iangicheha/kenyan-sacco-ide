import { Router } from "express";
import { z } from "zod";
import { classifyIntent } from "../agents/intentClassifier.js";
import { getUploadedFileSheetNames, getUploadedSheet } from "../data/uploadStore.js";
import { enqueueAiPlanJob } from "../engine/asyncJobs.js";
import { emitOrchestratorEvent } from "../engine/orchestratorTelemetry.js";
import { getRequestContext } from "../engine/requestContext.js";
import { resolvePrompt } from "../lib/promptProvider.js";
import { askRoutedJson } from "../lib/modelRouterClient.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { buildRoutingInput } from "../model-router/catalog.js";
import { selectModelRoute } from "../model-router/router.js";
import type { Regulator } from "../types.js";

const requestSchema = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().min(1),
  regulator: z.enum(["CBK", "SASRA", "IRA", "RBA", "CMA"]).default("CBK"),
  fileName: z.string().min(1).optional(),
  sheetName: z.string().min(1).optional(),
});

export const aiRouter = Router();

function isSessionOwnedByTenant(sessionId: string, tenantId: string): boolean {
  return sessionId.startsWith(`${tenantId}:`);
}

function wantsFileSummary(prompt: string): boolean {
  // Only match requests for basic metadata/preview, NOT analysis questions
  // "show columns", "what headers", "preview" -> metadata only
  // "analyze", "what's inside", "tell me about the data" -> AI analysis
  const text = prompt.toLowerCase();
  const isMetadataOnly = /\b(columns?|headers?|preview|show.*structure|file info|metadata)\b/i.test(text);
  const isAnalysisQuestion = /\b(analy[sz]e|what.*inside|what.*data|tell me about|explain|insights|meaning|trends|patterns)\b/i.test(text);

  // If it's a metadata request AND not an analysis question, return summary
  return isMetadataOnly && !isAnalysisQuestion;
}

function isGreetingOrSmallTalk(prompt: string): boolean {
  const text = prompt.trim().toLowerCase();
  return /^(hi|hello|hey|yo|good (morning|afternoon|evening)|how are you|thanks|thank you|ok|okay)\b/.test(text);
}

function buildFileSummary(tenantId: string, fileName: string, sheetName?: string) {
  const availableSheets = getUploadedFileSheetNames(tenantId, fileName);
  const targetSheetName = sheetName ?? availableSheets[0];
  if (!targetSheetName) {
    return {
      status: "file_summary",
      summary: `**File Not Found**: "${fileName}" is not in the upload cache. Please upload the file again.`,
    };
  }

  const sheet = getUploadedSheet(tenantId, fileName, targetSheetName);
  if (!sheet) {
    return {
      status: "file_summary",
      summary: `**Sheet Not Found**: "${fileName}" loaded, but sheet "${targetSheetName}" not found. Available: ${availableSheets.join(", ")}`,
    };
  }

  const sampleRows = sheet.rows.slice(0, 5);
  return {
    status: "file_summary",
    fileName,
    sheetName: targetSheetName,
    rowCount: sheet.rows.length,
    headers: sheet.headers,
    previewRows: sampleRows,
    summary: `**File:** ${fileName}
**Sheet:** ${targetSheetName}
**Dimensions:** ${sheet.rows.length} rows × ${sheet.headers.length} columns
**Columns:** ${sheet.headers.join(", ")}
**Preview:** First 5 rows loaded.`,
  };
}

function resolveSheet(tenantId: string, fileName: string, sheetName?: string) {
  const availableSheets = getUploadedFileSheetNames(tenantId, fileName);
  const targetSheetName = sheetName ?? availableSheets[0];
  if (!targetSheetName) return null;
  const sheet = getUploadedSheet(tenantId, fileName, targetSheetName);
  if (!sheet) return null;
  return { sheet, targetSheetName };
}

function buildSheetContext(tenantId: string, fileName: string, prompt: string, sheetName?: string) {
  const resolved = resolveSheet(tenantId, fileName, sheetName);
  if (!resolved) return null as null;
  const { sheet, targetSheetName } = resolved;
  const sampleRows = sheet.rows.slice(0, 100);
  return {
    fileName,
    sheetName: targetSheetName,
    headers: sheet.headers,
    rowCount: sheet.rows.length,
    sampleRows,
    prompt,
  };
}

async function answerConversationally(input: {
  tenantId: string;
  sessionId: string;
  correlationId: string;
  role: "read-only" | "analyst" | "reviewer" | "admin";
  prompt: string;
  fileName?: string;
  sheetName?: string;
}) {
  let contextNote = "No file context provided.";
  if (input.fileName) {
    const context = buildSheetContext(input.tenantId, input.fileName, input.prompt, input.sheetName);
    if (context) {
      contextNote = `File: ${context.fileName}, Sheet: ${context.sheetName}, Rows: ${context.rowCount}, Headers: ${context.headers.join(", ")}, SampleRows: ${JSON.stringify(context.sampleRows)}`;
    }
  }

  const route = selectModelRoute(
    buildRoutingInput({
      userQuery: input.prompt,
      taskType: "chat",
      mode: "auto",
      latencyPriority: "medium",
    })
  );
  const prompt = await resolvePrompt("chat_assistant");

  const modelResult = await askRoutedJson<{ answer?: string; response?: string }>({
    route,
    system: prompt.template,
    user: JSON.stringify({
      prompt: input.prompt,
      context: contextNote,
    }),
    governance: {
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      correlationId: input.correlationId,
      role: input.role,
      actionType: "chat",
      promptId: prompt.promptId,
      promptVersion: prompt.version,
    },
  });

  return {
    status: "chat",
    message:
      modelResult.data?.answer ?? modelResult.data?.response ?? "I could not generate a response right now.",
  };
}

async function answerFileQuestionWithModel(input: {
  tenantId: string;
  sessionId: string;
  correlationId: string;
  role: "read-only" | "analyst" | "reviewer" | "admin";
  fileName: string;
  prompt: string;
  sheetName?: string;
}) {
  const { tenantId, fileName, prompt, sheetName } = input;
  const context = buildSheetContext(tenantId, fileName, prompt, sheetName);
  if (!context) return null;

  const route = selectModelRoute(
    buildRoutingInput({
      userQuery: `Answer a question from uploaded spreadsheet: ${prompt}`,
      taskType: "analysis",
      mode: "auto",
      latencyPriority: "medium",
    })
  );
  const filePrompt = await resolvePrompt("file_analyst");

  const modelResult = await askRoutedJson<{ answer?: string }>({
    route,
    system: filePrompt.template,
    user: JSON.stringify(context),
    governance: {
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      correlationId: input.correlationId,
      role: input.role,
      actionType: "analysis",
      promptId: filePrompt.promptId,
      promptVersion: filePrompt.version,
    },
  });

  if (modelResult.data?.answer && modelResult.data.answer.trim().length > 0) {
    return {
      status: "file_answer",
      summary: modelResult.data.answer.trim(),
    };
  }

  return {
    status: "file_summary",
    summary: `I read "${context.fileName}" (${context.sheetName}). It has ${context.rowCount} rows and ${context.headers.length} columns: ${context.headers.join(", ")}.`,
  };
}

aiRouter.post("/chat", async (req, res) => {
  const request = req as AuthenticatedRequest;
  const context = getRequestContext(req);
  const tenantId = request.user?.tenantId ?? "default";
  try {
    res.setHeader("x-correlation-id", context.correlationId);
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        correlationId: context.correlationId,
        details: parsed.error.flatten(),
      });
    }
    if (!isSessionOwnedByTenant(parsed.data.sessionId, tenantId)) {
      return res.status(403).json({
        error: "Forbidden. Cross-tenant session access denied.",
        correlationId: context.correlationId,
      });
    }
    await emitOrchestratorEvent({
      tenantId,
      correlationId: context.correlationId,
      sessionId: parsed.data.sessionId,
      stage: "ingest",
      status: "ok",
      details: {
        hasFileContext: Boolean(parsed.data.fileName),
      },
    });

    if (parsed.data.fileName && wantsFileSummary(parsed.data.prompt)) {
      await emitOrchestratorEvent({
        tenantId,
        correlationId: context.correlationId,
        sessionId: parsed.data.sessionId,
        stage: "file_summary_shortcut",
        status: "ok",
      });
      return res.json({ ...buildFileSummary(tenantId, parsed.data.fileName, parsed.data.sheetName), correlationId: context.correlationId });
    }

    if (isGreetingOrSmallTalk(parsed.data.prompt)) {
      await emitOrchestratorEvent({
        tenantId,
        correlationId: context.correlationId,
        sessionId: parsed.data.sessionId,
        stage: "small_talk",
        status: "ok",
      });
      const response = await answerConversationally({
        tenantId,
        sessionId: parsed.data.sessionId,
        correlationId: context.correlationId,
        role: request.user?.role ?? "analyst",
        prompt: parsed.data.prompt,
        fileName: undefined,
        sheetName: undefined,
      });
      return res.json(
        { ...response, correlationId: context.correlationId }
      );
    }

    const classifyStartedAt = Date.now();
    const inferredIntent = await classifyIntent(parsed.data.prompt, parsed.data.regulator as Regulator, {
      tenantId,
      sessionId: parsed.data.sessionId,
      correlationId: context.correlationId,
      role: request.user?.role ?? "analyst",
    });
    await emitOrchestratorEvent({
      tenantId,
      correlationId: context.correlationId,
      sessionId: parsed.data.sessionId,
      stage: "classify_route",
      status: "ok",
      durationMs: Date.now() - classifyStartedAt,
      details: { confidence: inferredIntent.confidence, intent: inferredIntent.intent },
    });
    const shouldRunOperationalPipeline = inferredIntent.confidence >= 0.8 && inferredIntent.intent !== "unknown";

    if (!shouldRunOperationalPipeline) {
      await emitOrchestratorEvent({
        tenantId,
        correlationId: context.correlationId,
        sessionId: parsed.data.sessionId,
        stage: "route_non_operational",
        status: "fallback",
        details: { intent: inferredIntent.intent, confidence: inferredIntent.confidence },
      });
      if (parsed.data.fileName) {
        const answer = await answerFileQuestionWithModel({
          tenantId,
          sessionId: parsed.data.sessionId,
          correlationId: context.correlationId,
          role: request.user?.role ?? "analyst",
          fileName: parsed.data.fileName,
          prompt: parsed.data.prompt,
          sheetName: parsed.data.sheetName,
        });
        if (answer) return res.json({ ...answer, correlationId: context.correlationId });
      }
      const response = await answerConversationally({
        tenantId,
        sessionId: parsed.data.sessionId,
        correlationId: context.correlationId,
        role: request.user?.role ?? "analyst",
        prompt: parsed.data.prompt,
        fileName: parsed.data.fileName,
        sheetName: parsed.data.sheetName,
      });
      return res.json(
        { ...response, correlationId: context.correlationId }
      );
    }

    // Async pipeline is now the only path - always queue for processing
    const queuedJob = await enqueueAiPlanJob({
      tenantId,
      sessionId: parsed.data.sessionId,
      correlationId: context.correlationId,
      createdBy: request.user?.email ?? "system",
      payload: {
        prompt: parsed.data.prompt,
        regulator: parsed.data.regulator,
        actor: request.user?.email ?? "system",
        uploadId: parsed.data.fileName,
        sheetName: parsed.data.sheetName,
      },
    });
    await emitOrchestratorEvent({
      tenantId,
      correlationId: context.correlationId,
      sessionId: parsed.data.sessionId,
      stage: "queue_ai_plan",
      status: "ok",
      details: { jobId: queuedJob.id, requestId: queuedJob.requestId },
    });
    return res.status(202).json({
      status: "queued",
      mode: "async",
      queue: "ai_plan",
      jobId: queuedJob.id,
      requestId: queuedJob.requestId,
      correlationId: context.correlationId,
    });
  } catch (error) {
    console.error("AI chat route error:", error);
    return res.status(500).json({
      error: "Failed to process AI request.",
      message: "Please retry in a moment.",
      correlationId: context.correlationId,
    });
  }
});
