import { Router } from "express";

export const reportsRouter = Router();

reportsRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Reports route scaffold is ready.",
  });
});
