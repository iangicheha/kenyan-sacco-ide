import { pushAlert } from "../alerts/notifier";
import type { FinancialStreamEvent } from "../types";

const TREND_WINDOW = Math.max(5, Number(process.env.TREND_WINDOW ?? 20));
const series = new Map<string, number[]>();

export function evaluateTrend(event: FinancialStreamEvent): void {
  if (event.topic !== "market_data") return;
  const symbol = String(event.payload.symbol ?? "UNKNOWN");
  const price = Number(event.payload.price ?? NaN);
  if (!Number.isFinite(price)) return;
  const values = series.get(symbol) ?? [];
  values.push(price);
  if (values.length > TREND_WINDOW) values.shift();
  series.set(symbol, values);
  if (values.length < TREND_WINDOW) return;
  const first = values[0];
  const last = values[values.length - 1];
  const delta = ((last - first) / Math.max(1, Math.abs(first))) * 100;
  if (Math.abs(delta) < 10) return;
  pushAlert({
    level: "warn",
    title: "Market trend shift",
    message: `Price trend moved ${delta.toFixed(2)}% for ${symbol}.`,
    metadata: { symbol, deltaPercent: delta, eventId: event.id },
  });
}
