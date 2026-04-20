import cors from "cors";
import express from "express";
import { env, hasClaude, hasGroq, hasOpenRouter, hasSupabase } from "./config/env.js";
import { closeAsyncJobQueues, isAsyncWorkerEnabled } from "./engine/asyncJobs.js";
import { closeOutboxDispatcher, dispatchPendingOutboxEvents } from "./engine/outboxStore.js";
import { requireAuth, requireRoles } from "./middleware/auth.js";
import { requireTenantContext } from "./middleware/tenantContext.js";
import { adminRouter } from "./routes/admin.js";
import { aiRouter } from "./routes/ai.js";
import { alertsRouter } from "./routes/alerts.js";
import { authRouter } from "./routes/auth.js";
import { filesRouter } from "./routes/files.js";
import { policiesRouter } from "./routes/policies.js";
import { realtimeRouter } from "./routes/realtime.js";
import { reportsRouter } from "./routes/reports.js";
import { routerRouter } from "./routes/router.js";
import { spreadsheetRouter } from "./routes/spreadsheet.js";
import { startAiWorker, stopAiWorker } from "./workers/aiWorker.js";
import { startExecutionWorker, stopExecutionWorker } from "./workers/executionWorker.js";
import { startShadowWorker, stopShadowWorker } from "./workers/shadowWorker.js";
import { startValidationWorker, stopValidationWorker } from "./workers/validationWorker.js";

const app = express();
const port = env.port;
let outboxTimer: NodeJS.Timeout | null = null;

const localhostOrigins = ["http://localhost:3000", "http://localhost:4100", "http://127.0.0.1:3000", "http://127.0.0.1:4100"];
const configuredOrigins = env.nodeEnv === "production" ? env.allowedOrigins : [...localhostOrigins, ...env.allowedOrigins];
const allowedOrigins = new Set(configuredOrigins);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS policy."));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "kenyan-financial-ide-server" });
});

// Apply tenant context middleware to all protected routes when RLS is enforced
// This injects the tenant_id into the database session for RLS policies
const tenantMiddleware = env.rlsEnforced ? [requireAuth, requireTenantContext] : [requireAuth];

app.use("/api/ai", ...tenantMiddleware, aiRouter);
app.use("/api/spreadsheet", ...tenantMiddleware, spreadsheetRouter);
app.use("/api/files", ...tenantMiddleware, filesRouter);
app.use("/api/reports", requireAuth, requireRoles(["analyst", "reviewer", "admin"]), reportsRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", requireAuth, requireRoles(["admin"]), adminRouter);
app.use("/api/policies", requireAuth, policiesRouter);
app.use("/api/router", requireAuth, requireRoles(["admin"]), routerRouter);
app.use("/api/realtime", requireAuth, requireRoles(["analyst", "reviewer", "admin"]), realtimeRouter);
app.use("/api/alerts", requireAuth, requireRoles(["analyst", "reviewer", "admin"]), alertsRouter);

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(
    `[startup] providers: claude=${hasClaude()} groq=${hasGroq()} openrouter=${hasOpenRouter()} supabase=${hasSupabase()}`
  );
  // eslint-disable-next-line no-console
  console.log("[startup] routes: /health /api/router/health /api/router/select /api/router/debug-score /api/ai/chat");
  if (isAsyncWorkerEnabled()) {
    startAiWorker();
    startValidationWorker();
    startShadowWorker();
    startExecutionWorker();
    // eslint-disable-next-line no-console
    console.log("[startup] async workers: ai + validation + shadow + execution started");
  }
  if (env.eventBusEnabled) {
    outboxTimer = setInterval(() => {
      void dispatchPendingOutboxEvents();
    }, 1000);
    // eslint-disable-next-line no-console
    console.log("[startup] outbox dispatcher started");
  }
});

process.on("uncaughtException", (error) => {
  // eslint-disable-next-line no-console
  console.error("[fatal] uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("[fatal] unhandledRejection", reason);
});

process.on("SIGTERM", () => {
  if (outboxTimer) {
    clearInterval(outboxTimer);
    outboxTimer = null;
  }
  stopAiWorker();
  stopValidationWorker();
  stopShadowWorker();
  stopExecutionWorker();
  void closeOutboxDispatcher();
  void closeAsyncJobQueues();
  server.close(() => {
    process.exit(0);
  });
});
