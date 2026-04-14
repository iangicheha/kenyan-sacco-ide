import { askRoutedJson } from "../lib/modelRouterClient.js";
import { buildRoutingInput } from "../model-router/catalog.js";
import { selectModelRoute } from "../model-router/router.js";
import { readRegulatoryConfig } from "../tools/readRegulatoryConfig.js";
import type { IntentResult, PlannerResult } from "../types.js";

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
    system:
      "You are a Kenyan financial planning assistant. Return strict JSON object with key 'plan' (array). Use formulas only; no computed numbers.",
    user: `Create an execution plan for intent "${intent.intent}" under regulator "${intent.regulation}" with thresholds ${JSON.stringify(lp ?? {})}.`,
  });
  if (llmPlan?.plan && Array.isArray(llmPlan.plan)) {
    return llmPlan;
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
