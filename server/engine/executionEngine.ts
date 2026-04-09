import type { AiExecutionPlan, ExecutionResult, PlanStep, RowRecord } from "../types";
import {
  arimaForecast,
  average,
  exponentialSmoothing,
  holtWintersForecast,
  linearRegressionForecast,
  movingAverage,
  sum,
} from "./financialModels";
import { getTable } from "../data/tableStore";

function numericColumn(rows: RowRecord[], column: string): number[] {
  return rows
    .map((r) => Number(r[column]))
    .filter((n) => Number.isFinite(n));
}

function executeStep(rows: RowRecord[], step: PlanStep): unknown {
  if (step.action === "select_column") {
    return rows.map((r) => r[step.column ?? ""]);
  }
  if (step.action === "aggregate" && step.column) {
    const values = numericColumn(rows, step.column);
    return step.operation === "avg" ? average(values) : sum(values);
  }
  if (step.action === "apply_model" && step.column) {
    const values = numericColumn(rows, step.column);
    const horizon = step.forecastHorizon ?? 1;
    if (step.type === "moving_average") {
      return movingAverage(values, step.period ?? 3);
    }
    if (step.type === "forecast") {
      const ma = movingAverage(values, step.period ?? 3);
      return ma.length > 0 ? ma[ma.length - 1] : 0;
    }
    if (step.type === "linear_regression") {
      return linearRegressionForecast(values, horizon);
    }
    if (step.type === "exponential_smoothing") {
      return exponentialSmoothing(values, step.alpha, horizon);
    }
    if (step.type === "holt_winters") {
      return holtWintersForecast(
        values,
        step.seasonLength ?? 4,
        horizon,
        step.alpha,
        step.beta,
        step.gamma
      );
    }
    if (step.type === "arima") {
      return arimaForecast(values, step.p, step.d, step.q, horizon);
    }
  }
  if (step.action === "batch_execute" && Array.isArray(step.steps)) {
    return step.steps.map((nested) => executeStep(rows, nested));
  }
  return null;
}

export function executePlan(plan: AiExecutionPlan): ExecutionResult {
  const started = Date.now();
  const table = getTable(plan.tableName);
  if (!table) {
    throw new Error(`Table "${plan.tableName}" not found`);
  }
  if (table.version !== plan.schemaVersion) {
    throw new Error(
      `Schema version mismatch for "${plan.tableName}". plan=${plan.schemaVersion}, current=${table.version}`
    );
  }
  const steps = plan.steps.map((step) => ({ step, output: executeStep(table.rows, step) }));
  const final = steps.length > 0 ? steps[steps.length - 1].output : null;
  const elapsedMs = Date.now() - started;
  return {
    summary: `Executed ${steps.length} deterministic step(s) on ${plan.tableName} in ${elapsedMs}ms.`,
    steps,
    result: final,
  };
}
