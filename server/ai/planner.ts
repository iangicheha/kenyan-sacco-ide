import type { AiExecutionPlan } from "../types";
import type { InterpretedIntent } from "./interpreter";
import { getCurrentSchemaVersion, listSchemas } from "../data/tableStore";

function pickTable(tableName?: string): string {
  if (tableName) return tableName;
  const schemas = listSchemas();
  if (schemas.length === 0) throw new Error("No table loaded. Upload data first.");
  return schemas[0].tableName;
}

export function buildPlan(
  intent: InterpretedIntent,
  tableName?: string
): AiExecutionPlan {
  const selectedTable = pickTable(tableName);
  const schemaVersion = getCurrentSchemaVersion(selectedTable);
  if (schemaVersion === null) {
    throw new Error(`Table "${selectedTable}" not found.`);
  }
  const column = intent.targetColumn ?? "revenue";
  if (intent.intent === "forecast") {
    const model = intent.forecastModel ?? "moving_average";
    return {
      intent: "forecast",
      tableName: selectedTable,
      schemaVersion,
      steps: [
        { action: "select_column", column },
        {
          action: "apply_model",
          type: model,
          column,
          period: 3,
          forecastHorizon: 3,
          seasonLength: 4,
          d: 1,
          p: 1,
          q: 0,
        },
      ],
    };
  }
  if (intent.intent === "average") {
    return {
      intent: "average",
      tableName: selectedTable,
      schemaVersion,
      steps: [{ action: "aggregate", operation: "avg", column }],
    };
  }
  return {
    intent: "sum",
    tableName: selectedTable,
    schemaVersion,
    steps: [{ action: "aggregate", operation: "sum", column }],
  };
}
