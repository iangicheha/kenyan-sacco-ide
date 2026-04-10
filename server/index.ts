import express from "express";
import cors from "cors";
import { apiAuth } from "./middleware/apiAuth";
import { healthRouter } from "./api/routes/health";
import { uploadRouter } from "./api/routes/upload";
import { aiRouter } from "./api/routes/ai";
import { tablesRouter } from "./api/routes/tables";
import { realtimeRouter } from "./api/routes/realtime";
import { startStreamingConsumers } from "./streaming/consumers";

export function createApp() {
  const app = express();
  startStreamingConsumers();
  app.use(cors());
  app.use(express.json());
  app.use("/api", apiAuth);
  app.use("/api", healthRouter);
  app.use("/api", uploadRouter);
  app.use("/api", aiRouter);
  app.use("/api", tablesRouter);
  app.use("/api", realtimeRouter);
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  return app;
}

const port = Number(process.env.PORT ?? 3001);
if (process.env.NODE_ENV !== "test") {
  createApp().listen(port, () => {
    console.log(`Meridian API listening on ${port}`);
  });
}
