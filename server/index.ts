import cors from "cors";
import express from "express";
import { env, hasClaude, hasGroq, hasOpenRouter, hasSupabase } from "./config/env.js";
import { requireAuth, requireRoles } from "./middleware/auth.js";
import { adminRouter } from "./routes/admin.js";
import { aiRouter } from "./routes/ai.js";
import { alertsRouter } from "./routes/alerts.js";
import { authRouter } from "./routes/auth.js";
import { filesRouter } from "./routes/files.js";
import { realtimeRouter } from "./routes/realtime.js";
import { reportsRouter } from "./routes/reports.js";
import { routerRouter } from "./routes/router.js";
import { spreadsheetRouter } from "./routes/spreadsheet.js";

const app = express();
const port = env.port;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "kenyan-financial-ide-server" });
});

app.use("/api/ai", requireAuth, aiRouter);
app.use("/api/spreadsheet", requireAuth, spreadsheetRouter);
app.use("/api/files", filesRouter);
app.use("/api", filesRouter);
app.use("/api/reports", requireAuth, requireRoles(["analyst", "reviewer", "admin"]), reportsRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", requireAuth, requireRoles(["admin"]), adminRouter);
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
  server.close(() => {
    process.exit(0);
  });
});
