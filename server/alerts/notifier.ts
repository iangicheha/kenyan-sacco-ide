import type { AlertRecord } from "../types";

const MAX_ALERTS = Math.max(50, Number(process.env.ALERT_HISTORY_LIMIT ?? 500));
const alerts: AlertRecord[] = [];

function createAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function pushAlert(input: Omit<AlertRecord, "id" | "createdAt">): AlertRecord {
  const alert: AlertRecord = {
    id: createAlertId(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  alerts.push(alert);
  if (alerts.length > MAX_ALERTS) {
    alerts.splice(0, alerts.length - MAX_ALERTS);
  }
  console.log(
    `[alert][${alert.level}] ${alert.title}: ${alert.message} ${alert.metadata ? JSON.stringify(alert.metadata) : ""}`
  );
  return alert;
}

export function getAlerts(): AlertRecord[] {
  return alerts.slice().reverse();
}
