import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { mapExecutionToSteps, type UIStep } from "@/utils/stepMapper";

type AiPanelResponse = {
  execution?: { steps?: unknown[] };
  result?: unknown;
  error?: string;
};

interface AIPanelProps {
  isLoading: boolean;
  response: AiPanelResponse | null;
}

function formatInlineResult(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    const extracted = (value as Record<string, unknown>).value;
    return typeof extracted === "number" ? extracted.toLocaleString() : String(extracted ?? "");
  }
  return String(value);
}

export function AIPanel({ isLoading, response }: AIPanelProps) {
  const steps = useMemo(() => mapExecutionToSteps(response?.execution), [response?.execution]);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
  }, [response]);

  useEffect(() => {
    if (steps.length === 0) return;
    if (visibleCount >= steps.length) return;
    const timer = window.setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 1, steps.length));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [steps, visibleCount]);

  const visibleSteps: UIStep[] = steps.slice(0, visibleCount);
  const resultText = formatInlineResult(response?.result);
  const errorText = response?.error ? String(response.error) : "";
  const isDone = !isLoading && !errorText && response !== null;

  return (
    <div className="space-y-3 text-sm">
      {isLoading && !errorText && (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Processing...</span>
        </div>
      )}

      {errorText ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">Failed: {errorText}</div>
      ) : (
        <>
          {visibleSteps.map((step, index) => (
            <div key={`${step.label}-${index}`} className="flex items-center gap-2 text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{step.label}</span>
            </div>
          ))}

          {!isLoading && resultText && (
            <div className="text-slate-600">
              Result: <span className="font-medium text-slate-900">{resultText}</span>
            </div>
          )}

          {isDone && <div className="font-medium text-slate-900">Done</div>}
        </>
      )}
    </div>
  );
}
