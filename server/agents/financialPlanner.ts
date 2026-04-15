import { askRoutedJson } from "../lib/modelRouterClient.js";
import { buildRoutingInput } from "../model-router/catalog.js";
import { selectModelRoute } from "../model-router/router.js";
import { readRegulatoryConfig } from "../tools/readRegulatoryConfig.js";
import { z } from "zod";
import type { IntentResult, PlannerResult } from "../types.js";

const plannerSchema = z.object({
  plan: z.array(
    z.object({
      step: z.number().int().positive(),
      action: z.enum(["read_column", "write_formula", "write_value"]),
      target: z.string().min(1),
      formula: z.string().optional(),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
      reasoning: z.string().min(1),
      regulationReference: z.string().optional(),
    })
  ),
});

export async function buildFinancialPlan(intent: IntentResult): Promise<PlannerResult> {
  const regulatoryConfig = (await readRegulatoryConfig(intent.regulation).catch(() => null)) as
    | {
        loan_provisioning?: {
          normal: number;
          watch: number;
          substandard: number;
          doubtful: number;
          loss: number;
          reference?: string;
        };
      }
    | null;
  const lp = regulatoryConfig?.loan_provisioning;

  const route = selectModelRoute(
    buildRoutingInput({
      userQuery: `Create a planning workflow for ${intent.intent} under ${intent.regulation}`,
      taskType: "planning",
      mode: "auto",
      latencyPriority: "medium",
    })
  );

  const llmPlan = await askRoutedJson<PlannerResult>({
    route,
    system: `You are a Meridian Financial AI planning engine for Kenyan SACCOs and financial institutions.

Create a structured execution plan for spreadsheet operations.

CRITICAL RULES:
- Return ONLY formulas; NEVER compute numerical results yourself
- Each formula must be valid Excel/Google Sheets syntax
- Reference specific column names or cell ranges
- Include regulatory citations where applicable
- Plans must be executable deterministically by the engine

Return strict JSON with key "plan" containing an array of steps. Each step has:
- "step": number (1-indexed)
- "action": "read_column" | "write_formula" | "write_value"
- "target": string (column name, cell reference, or range)
- "formula": string (Excel formula, for write_formula actions)
- "value": string | number | boolean | null (for write_value actions)
- "reasoning": string (brief explanation of why this step)
- "regulationReference": string (optional, e.g., "CBK/PG/15 Section 4.2")

Use Kenyan SACCO regulatory guidelines (CBK, SASRA) for provisioning and compliance.`,
    user: `Create an execution plan for intent "${intent.intent}" under regulator "${intent.regulation}" with thresholds ${JSON.stringify(lp ?? {})}.`,
  });
  const parsed = plannerSchema.safeParse(llmPlan);
  if (parsed.success) {
    return parsed.data;
  }

  if (intent.intent === "calculate_provisioning") {
    return {
      plan: [
        {
          step: 1,
          action: "read_column",
          target: "days_overdue_column",
          reasoning: "Find overdue days per loan.",
        },
        {
          step: 2,
          action: "write_formula",
          target: "provision_column",
          formula: `=IF(D2>365,B2*${lp?.loss ?? 1},IF(D2>180,B2*${lp?.doubtful ?? 0.5},IF(D2>90,B2*${lp?.substandard ?? 0.2},IF(D2>30,B2*${lp?.watch ?? 0.03},B2*${lp?.normal ?? 0.01}))))`,
          reasoning: "Apply regulator provisioning bands by overdue age.",
          regulationReference: lp?.reference ?? "CBK/PG/15 Section 4.2",
        },
        {
          step: 3,
          action: "write_formula",
          target: "total_provision_cell",
          formula: "=SUM(E2:E1000)",
          reasoning: "Total portfolio provision.",
        },
      ],
    };
  }

  return { plan: [] };
}
