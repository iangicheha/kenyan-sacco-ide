import { Router } from "express";
import { z } from "zod";
import { getActivePolicy } from "../engine/policyStore.js";

export const policiesRouter = Router();

const regulatorSchema = z.enum(["CBK", "SASRA", "IRA", "RBA", "CMA"]);

policiesRouter.get("/active", async (req, res) => {
  const regulatorParam = typeof req.query.regulator === "string" ? req.query.regulator : undefined;
  const atIso = typeof req.query.atTime === "string" ? req.query.atTime : undefined;

  if (regulatorParam) {
    const parsed = regulatorSchema.safeParse(regulatorParam);
    if (!parsed.success) return res.status(400).json({ error: "Invalid regulator." });
    const policy = await getActivePolicy(parsed.data, atIso ?? new Date().toISOString());
    return res.json({ status: "ok", regulator: parsed.data, policy });
  }

  const regulators = regulatorSchema.options;
  const policies = await Promise.all(regulators.map(async (reg) => [reg, await getActivePolicy(reg, atIso ?? new Date().toISOString())] as const));
  return res.json({
    status: "ok",
    policies: Object.fromEntries(policies),
  });
});

