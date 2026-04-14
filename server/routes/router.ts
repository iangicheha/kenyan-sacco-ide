import { Router } from "express";
import { z } from "zod";
import { buildRoutingInput } from "../model-router/catalog.js";
import { explainModelRoute, selectModelRoute } from "../model-router/router.js";
import type { RoutingInput } from "../model-router/types.js";

const providerSchema = z.object({
  name: z.enum(["ollama", "groq", "openrouter", "claude"]),
  available: z.boolean(),
  latency_ms: z.number(),
  error_rate: z.number(),
  healthy: z.boolean(),
});

const modelSchema = z.object({
  name: z.string(),
  provider: z.enum(["ollama", "groq", "openrouter", "claude"]),
  available: z.boolean(),
  context_window: z.number(),
  supports_json: z.boolean(),
  supports_tools: z.boolean(),
  avg_latency_ms: z.number(),
  cost_per_1k_tokens: z.number(),
  quality_score: z.number(),
});

const requestSchema = z.object({
  user_query: z.string(),
  mode: z.enum(["auto", "free", "paid"]),
  task_type: z.enum(["classification", "formula", "planning", "analysis", "chat"]),
  complexity: z.enum(["low", "medium", "high"]),
  latency_priority: z.enum(["low", "medium", "high"]),
  requirements: z.object({
    needs_json: z.boolean(),
    needs_tools: z.boolean(),
    min_context_tokens: z.number(),
  }),
  providers: z.array(providerSchema),
  models: z.array(modelSchema),
});

export const routerRouter = Router();

routerRouter.get("/health", (_req, res) => {
  const sample = selectModelRoute(
    buildRoutingInput({
      userQuery: "health-check",
      taskType: "classification",
      mode: "auto",
      latencyPriority: "high",
    })
  );
  return res.json({
    status: "ok",
    route: "/api/router/select",
    sample_selection: {
      selected_model: sample.selected_model,
      provider: sample.provider,
      fallback_model: sample.fallback_model,
      fallback_provider: sample.fallback_provider,
    },
  });
});

routerRouter.post("/select", (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid routing input.", details: parsed.error.flatten() });
  }
  const result = selectModelRoute(parsed.data as RoutingInput);
  return res.json(result);
});

routerRouter.post("/debug-score", (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid routing input.", details: parsed.error.flatten() });
  }
  const result = explainModelRoute(parsed.data as RoutingInput);
  return res.json(result);
});
