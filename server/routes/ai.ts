import { Router } from "express";
import { z } from "zod";
import { classifyIntent } from "../agents/intentClassifier.js";
import { getUploadedFileSheetNames, getUploadedSheet } from "../data/uploadStore.js";
import { emitOrchestratorEvent } from "../engine/orchestratorTelemetry.js";
import { getRequestContext } from "../engine/requestContext.js";
import { askRoutedJson } from "../lib/modelRouterClient.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { buildRoutingInput } from "../model-router/catalog.js";
import { selectModelRoute } from "../model-router/router.js";
import { runPlanningPipeline } from "../pipeline/runAiPipeline.js";
import type { Regulator } from "../types.js";

const requestSchema = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().min(1),
  regulator: z.enum(["CBK", "SASRA", "IRA", "RBA", "CMA"]).default("CBK"),
  fileName: z.string().min(1).optional(),
  sheetName: z.string().min(1).optional(),
});

export const aiRouter = Router();

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

function buildFileSummary(fileName: string, sheetName?: string) {
  const availableSheets = getUploadedFileSheetNames(fileName);
  const targetSheetName = sheetName ?? availableSheets[0];
  if (!targetSheetName) {
    return {
      status: "file_summary",
      summary: `**File Not Found**: "${fileName}" is not in the upload cache. Please upload the file again.`,
    };
  }

  const sheet = getUploadedSheet(fileName, targetSheetName);
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

function resolveSheet(fileName: string, sheetName?: string) {
  const availableSheets = getUploadedFileSheetNames(fileName);
  const targetSheetName = sheetName ?? availableSheets[0];
  if (!targetSheetName) return null;
  const sheet = getUploadedSheet(fileName, targetSheetName);
  if (!sheet) return null;
  return { sheet, targetSheetName };
}

function buildSheetContext(fileName: string, prompt: string, sheetName?: string) {
  const resolved = resolveSheet(fileName, sheetName);
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
  prompt: string;
  fileName?: string;
  sheetName?: string;
}) {
  let contextNote = "No file context provided.";
  if (input.fileName) {
    const context = buildSheetContext(input.fileName, input.prompt, input.sheetName);
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

  const modelResult = await askRoutedJson<{ answer?: string; response?: string }>({
    route,
    system: `You are a Meridian Financial AI spreadsheet assistant for Kenyan SACCOs and financial institutions.

Provide clear, professional responses about spreadsheet data and financial operations.

GUIDELINES:
- Be concise and professional
- Reference specific columns, ranges, or cells when applicable
- Cite regulatory guidelines (CBK, SASRA, IRA, RBA, CMA) when relevant
- If file context is provided, base your answer on that data
- For calculations, explain the formula logic, not just the result

Return strict JSON: {"answer": "your response string"}`,
    user: JSON.stringify({
      prompt: input.prompt,
      context: contextNote,
    }),
  });

  return {
    status: "chat",
    message: modelResult?.answer ?? modelResult?.response ?? "I could not generate a response right now.",
  };
}

async function answerFileQuestionWithModel(fileName: string, prompt: string, sheetName?: string) {
  const context = buildSheetContext(fileName, prompt, sheetName);
  if (!context) return null;

  const route = selectModelRoute(
    buildRoutingInput({
      userQuery: `Answer a question from uploaded spreadsheet: ${prompt}`,
      taskType: "analysis",
      mode: "auto",
      latencyPriority: "medium",
    })
  );

  const modelResult = await askRoutedJson<{ answer?: string }>({
    route,
    system: `You are a Meridian Financial AI spreadsheet analyst for Kenyan SACCOs and financial institutions.

Analyze the provided spreadsheet data and provide structured insights.

GUIDELINES:
- Answer ONLY from the provided sheet context
- Reference specific column names, row ranges, or cell addresses
- Highlight anomalies, trends, or compliance issues where relevant
- If data is insufficient, clearly state what is missing
- For financial metrics, explain the calculation methodology
- Cite regulatory guidelines (CBK, SASRA) when applicable

Return strict JSON: {"answer": "your response string"}`,
    user: JSON.stringify(context),
  });

  if (modelResult?.answer && modelResult.answer.trim().length > 0) {
    return {
      status: "file_answer",
      summary: modelResult.answer.trim(),
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
    await emitOrchestratorEvent({
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
        correlationId: context.correlationId,
        sessionId: parsed.data.sessionId,
        stage: "file_summary_shortcut",
        status: "ok",
      });
      return res.json({ ...buildFileSummary(parsed.data.fileName, parsed.data.sheetName), correlationId: context.correlationId });
    }

    if (isGreetingOrSmallTalk(parsed.data.prompt)) {
      await emitOrchestratorEvent({
        correlationId: context.correlationId,
        sessionId: parsed.data.sessionId,
        stage: "small_talk",
        status: "ok",
      });
      const response = await answerConversationally({
        prompt: parsed.data.prompt,
        fileName: undefined,
        sheetName: undefined,
      });
      return res.json(
        { ...response, correlationId: context.correlationId }
      );
    }

    const classifyStartedAt = Date.now();
    const inferredIntent = await classifyIntent(parsed.data.prompt, parsed.data.regulator as Regulator);
    await emitOrchestratorEvent({
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
        correlationId: context.correlationId,
        sessionId: parsed.data.sessionId,
        stage: "route_non_operational",
        status: "fallback",
        details: { intent: inferredIntent.intent, confidence: inferredIntent.confidence },
      });
      if (parsed.data.fileName) {
        const answer = await answerFileQuestionWithModel(parsed.data.fileName, parsed.data.prompt, parsed.data.sheetName);
        if (answer) return res.json({ ...answer, correlationId: context.correlationId });
      }
      const response = await answerConversationally({
        prompt: parsed.data.prompt,
        fileName: parsed.data.fileName,
        sheetName: parsed.data.sheetName,
      });
      return res.json(
        { ...response, correlationId: context.correlationId }
      );
    }

    const result = await runPlanningPipeline({
      sessionId: parsed.data.sessionId,
      analystPrompt: parsed.data.prompt,
      regulator: parsed.data.regulator as Regulator,
      correlationId: context.correlationId,
      actor: request.user?.email ?? "system",
      preclassifiedIntent: inferredIntent,
    });

    if (result.status === "clarification_required" && parsed.data.fileName) {
      const answer = await answerFileQuestionWithModel(parsed.data.fileName, parsed.data.prompt, parsed.data.sheetName);
      if (answer) return res.json({ ...answer, correlationId: context.correlationId });
      return res.json({ ...buildFileSummary(parsed.data.fileName, parsed.data.sheetName), correlationId: context.correlationId });
    }

    return res.json({ ...result, correlationId: context.correlationId });
  } catch (error) {
    console.error("AI chat route error:", error);
    return res.status(500).json({
      error: "Failed to process AI request.",
      message: "Please retry in a moment.",
      correlationId: context.correlationId,
    });
  }
});
