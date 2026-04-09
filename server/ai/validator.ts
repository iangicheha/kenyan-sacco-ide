import { z } from "zod";
import { getTable, getTableByVersion } from "../data/tableStore";
import type { AiExecutionPlan, RetrievedContext, RowRecord } from "../types";

const planSchema = z.object({
  intent: z.string().min(1),
  tableName: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  steps: z
    .array(
      z.object({
        action: z.enum([
          "select_column",
          "apply_model",
          "aggregate",
          "fetch_external_rate",
          "batch_execute",
        ]),
        column: z.string().optional(),
        operation: z.enum(["sum", "avg"]).optional(),
        type: z
          .enum([
            "moving_average",
            "forecast",
            "holt_winters",
            "linear_regression",
            "exponential_smoothing",
            "arima",
          ])
          .optional(),
        period: z.number().int().positive().optional(),
        forecastHorizon: z.number().int().positive().optional(),
        seasonLength: z.number().int().positive().optional(),
        alpha: z.number().positive().max(1).optional(),
        beta: z.number().positive().max(1).optional(),
        gamma: z.number().positive().max(1).optional(),
        d: z.number().int().nonnegative().optional(),
        p: z.number().int().nonnegative().optional(),
        q: z.number().int().nonnegative().optional(),
        steps: z.array(z.any()).optional(),
      })
    )
    .min(1),
});

export function validatePlan(plan: AiExecutionPlan) {
  const parsed = planSchema.parse(plan);
  const table = getTable(parsed.tableName);
  if (!table) throw new Error(`Unknown table "${parsed.tableName}"`);
  if (!getTableByVersion(parsed.tableName, parsed.schemaVersion)) {
    throw new Error(
      `Unknown schema version "${parsed.schemaVersion}" for table "${parsed.tableName}"`
    );
  }
  const validColumns = new Set(table.schema.columns.map((c) => c.name.toLowerCase()));
  const walk = (steps: typeof parsed.steps) => {
    for (const step of steps) {
      if (step.column && !validColumns.has(step.column.toLowerCase())) {
        throw new Error(`Unknown column "${step.column}" for table "${parsed.tableName}"`);
      }
      if (step.action === "batch_execute" && Array.isArray(step.steps)) {
        walk(step.steps as typeof parsed.steps);
      }
    }
  };
  walk(parsed.steps);
  return parsed;
}

/**
 * Strip RAG artifacts that do not exist in the authoritative schema so retrieved
 * context cannot smuggle columns/tables into planning.
 */
export function filterRetrievedContextToSchema(retrieved: RetrievedContext): RetrievedContext {
  const validTables = retrieved.relevantTables
    .map((t) => {
      const table = getTable(t.name);
      if (!table) return null;
      const allowed = new Set(table.schema.columns.map((c) => c.name.toLowerCase()));
      const columns = t.columns.filter((c) => allowed.has(c.toLowerCase()));
      const sample =
        t.sample?.map((row) => {
          const out: Record<string, unknown> = {};
          for (const k of Object.keys(row)) {
            if (allowed.has(k.toLowerCase())) out[k] = row[k];
          }
          return out;
        }) ?? [];
      return {
        ...t,
        schemaVersion: table.version,
        columns: columns.length ? columns : table.schema.columns.map((c) => c.name),
        sample: sample.length ? (sample as RowRecord[]) : undefined,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const validColumns = retrieved.relevantColumns.filter((c) => {
    const table = getTable(c.tableName);
    if (!table) return false;
    return table.schema.columns.some((col) => col.name.toLowerCase() === c.column.toLowerCase());
  });

  const chunks = retrieved.selectedChunks?.filter((ch) => {
    if (ch.kind === "document") return true;
    try {
      const parsed = JSON.parse(ch.text) as { name?: string; tableName?: string; column?: string };
      if (ch.kind === "table") {
        const name = parsed.name;
        return Boolean(name && getTable(name));
      }
      if (ch.kind === "column") {
        const tableName = parsed.tableName;
        const column = parsed.column;
        if (!tableName || !column) return false;
        const table = getTable(tableName);
        return Boolean(table?.schema.columns.some((c) => c.name.toLowerCase() === column.toLowerCase()));
      }
    } catch {
      return false;
    }
    return false;
  });

  return {
    ...retrieved,
    relevantTables: validTables,
    relevantColumns: validColumns,
    relevantDocs: retrieved.relevantDocs,
    selectedChunks: chunks,
  };
}
