import { Router } from "express";

export const alertsRouter = Router();

alertsRouter.get("/", (_req, res) => {
  return res.json({
    alerts: [
      {
        id: "alert-1",
        level: "warn",
        title: "Provisioning Review Queue",
        message: "Pending operations require analyst approval.",
        createdAt: new Date().toISOString(),
      },
    ],
  });
});
