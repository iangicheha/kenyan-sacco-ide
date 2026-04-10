import type { FinancialStreamEvent, RealtimeState, RowRecord } from "../types";

const MAX_TABLE_ROWS = Math.max(50, Number(process.env.REALTIME_TABLE_LIMIT ?? 1000));

const state: RealtimeState = {
  tables: {},
  metrics: {
    transactionCount: 0,
    transactionVolume: 0,
    highRiskTransactionCount: 0,
    marketTickCount: 0,
    anomalyCount: 0,
    updatedAt: new Date(0).toISOString(),
  },
};

function bumpUpdatedAt(): void {
  state.metrics.updatedAt = new Date().toISOString();
}

function upsertTableRow(tableName: string, row: RowRecord): void {
  if (!state.tables[tableName]) {
    state.tables[tableName] = [];
  }
  state.tables[tableName].push(row);
  if (state.tables[tableName].length > MAX_TABLE_ROWS) {
    state.tables[tableName] = state.tables[tableName].slice(-MAX_TABLE_ROWS);
  }
}

export function applyRealtimeEvent(event: FinancialStreamEvent): void {
  state.lastEventId = event.id;
  if (event.topic === "transactions") {
    const amount = Number(event.payload.amount ?? 0);
    const riskScore = Number(event.payload.riskScore ?? 0);
    state.metrics.transactionCount += 1;
    if (Number.isFinite(amount)) state.metrics.transactionVolume += amount;
    if (Number.isFinite(riskScore) && riskScore >= 0.8) state.metrics.highRiskTransactionCount += 1;
    upsertTableRow("transactions", event.payload as RowRecord);
  } else if (event.topic === "market_data") {
    state.metrics.marketTickCount += 1;
    upsertTableRow("market_data", event.payload as RowRecord);
  } else if (event.topic === "financial_events") {
    upsertTableRow("financial_events", event.payload as RowRecord);
  }
  bumpUpdatedAt();
}

export function incrementAnomalyCounter(): void {
  state.metrics.anomalyCount += 1;
  bumpUpdatedAt();
}

export function getRealtimeState(): RealtimeState {
  return {
    ...state,
    tables: Object.fromEntries(
      Object.entries(state.tables).map(([k, rows]) => [k, rows.map((row) => ({ ...row }))])
    ),
    metrics: { ...state.metrics },
  };
}
