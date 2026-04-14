import { Router } from "express";
import { z } from "zod";
import { getUploadedFileSheetNames, getUploadedSheet } from "../data/uploadStore.js";
import { askRoutedJson } from "../lib/modelRouterClient.js";
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
  return /read|about the file|summar|analy[sz]e.*file|what.*file|columns?|headers?|preview/i.test(prompt);
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
      summary: `I cannot find "${fileName}" in the upload cache yet. Please upload it again.`,
    };
  }

  const sheet = getUploadedSheet(fileName, targetSheetName);
  if (!sheet) {
    return {
      status: "file_summary",
      summary: `I found "${fileName}" but not sheet "${targetSheetName}".`,
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
    summary: `I read "${fileName}" (${targetSheetName}). It has ${sheet.rows.length} rows and ${sheet.headers.length} columns: ${sheet.headers.join(", ")}.`,
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
  const sampleRows = sheet.rows.slice(0, 50);
  return {
    fileName,
    sheetName: targetSheetName,
    headers: sheet.headers,
    rowCount: sheet.rows.length,
    sampleRows,
    prompt,
  };
}

function wantsOperationalPlan(prompt: string): boolean {
  return /formula|provision|calculate|apply|write|fill|update|fix|generate.*report|sasra/i.test(prompt);
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
    system:
      "You are a helpful spreadsheet assistant. Answer naturally like a normal chat assistant. If file context is present, use it. Return strict JSON: {\"answer\":\"...\"}.",
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
    system:
      "You are a spreadsheet analyst. Answer ONLY from the provided sheet context. If data is insufficient, say what is missing. Return strict JSON: {\"answer\":\"...\"}.",
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
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request body.",
      details: parsed.error.flatten(),
    });
  }

  if (parsed.data.fileName && wantsFileSummary(parsed.data.prompt)) {
    return res.json(buildFileSummary(parsed.data.fileName, parsed.data.sheetName));
  }

  if (isGreetingOrSmallTalk(parsed.data.prompt)) {
    return res.json(
      await answerConversationally({
        prompt: parsed.data.prompt,
        fileName: undefined,
        sheetName: undefined,
      })
    );
  }

  if (!wantsOperationalPlan(parsed.data.prompt)) {
    if (parsed.data.fileName) {
      const answer = await answerFileQuestionWithModel(parsed.data.fileName, parsed.data.prompt, parsed.data.sheetName);
      if (answer) return res.json(answer);
    }
    return res.json(
      await answerConversationally({
        prompt: parsed.data.prompt,
        fileName: parsed.data.fileName,
        sheetName: parsed.data.sheetName,
      })
    );
  }

  const result = await runPlanningPipeline({
    sessionId: parsed.data.sessionId,
    analystPrompt: parsed.data.prompt,
    regulator: parsed.data.regulator as Regulator,
  });

  if (result.status === "clarification_required" && parsed.data.fileName) {
    const answer = await answerFileQuestionWithModel(parsed.data.fileName, parsed.data.prompt, parsed.data.sheetName);
    if (answer) return res.json(answer);
    return res.json(buildFileSummary(parsed.data.fileName, parsed.data.sheetName));
  }

  return res.json(result);
});
