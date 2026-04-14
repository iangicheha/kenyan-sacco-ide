import { useEffect, useMemo, useState } from "react";
import { Bell, Activity, AlertTriangle } from "lucide-react";
import { apiUrl } from "@/lib/api";

type RealtimeMetrics = {
  transactionCount: number;
  transactionVolume: number;
  highRiskTransactionCount: number;
  marketTickCount: number;
  anomalyCount: number;
  updatedAt: string;
};

type AlertItem = {
  id: string;
  level: "info" | "warn" | "critical";
  title: string;
  message: string;
  createdAt: string;
};

const INITIAL_METRICS: RealtimeMetrics = {
  transactionCount: 0,
  transactionVolume: 0,
  highRiskTransactionCount: 0,
  marketTickCount: 0,
  anomalyCount: 0,
  updatedAt: new Date(0).toISOString(),
};

export function RealtimeIntelligencePanel() {
  const [metrics, setMetrics] = useState<RealtimeMetrics>(INITIAL_METRICS);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [stateRes, alertRes] = await Promise.all([
          fetch(apiUrl("/api/realtime/state")),
          fetch(apiUrl("/api/alerts")),
        ]);
        if (!stateRes.ok || !alertRes.ok || cancelled) return;
        const stateJson = await stateRes.json();
        const alertJson = await alertRes.json();
        setMetrics(stateJson?.state?.metrics ?? INITIAL_METRICS);
        setAlerts(Array.isArray(alertJson?.alerts) ? alertJson.alerts.slice(0, 5) : []);
      } catch {
        // keep UI resilient during backend restarts
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const formattedVolume = useMemo(
    () =>
      Number(metrics.transactionVolume || 0).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      }),
    [metrics.transactionVolume]
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">Realtime Intelligence</div>
        <Activity className="h-4 w-4 text-blue-600" />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-slate-200 bg-white px-2 py-1.5">Txns: {metrics.transactionCount}</div>
        <div className="rounded border border-slate-200 bg-white px-2 py-1.5">Volume: {formattedVolume}</div>
        <div className="rounded border border-slate-200 bg-white px-2 py-1.5">High Risk: {metrics.highRiskTransactionCount}</div>
        <div className="rounded border border-slate-200 bg-white px-2 py-1.5">Anomalies: {metrics.anomalyCount}</div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-600">
          <Bell className="h-3 w-3" />
          Alerts
        </div>
        {alerts.length === 0 ? (
          <div className="text-xs text-slate-500">No alerts yet.</div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded border border-slate-200 bg-white p-2 text-xs">
              <div className="flex items-center gap-1 font-semibold text-slate-700">
                <AlertTriangle className="h-3 w-3" />
                {alert.title}
              </div>
              <div className="text-slate-600">{alert.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
