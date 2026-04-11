export type UIStep = {
  label: string;
  status: "done";
};

type ExecutionStep = {
  operation?: string;
  op?: string;
  action?: string;
  input?: string;
  value?: string;
  column?: string;
  step?: {
    action?: string;
    operation?: string;
    op?: string;
    column?: string;
    input?: string;
    value?: string;
  };
};

type ExecutionPayload = {
  steps?: unknown[];
};

function asStep(step: unknown): ExecutionStep {
  if (!step || typeof step !== "object") return {};
  return step as ExecutionStep;
}

export function mapExecutionToSteps(execution: ExecutionPayload | null | undefined): UIStep[] {
  if (!execution?.steps || !Array.isArray(execution.steps)) return [];

  return execution.steps.map((rawStep) => {
    const step = asStep(rawStep);
    const operation = step.operation || step.op || step.action || step.step?.operation || step.step?.op || step.step?.action;
    const stepInput = step.input || step.step?.input || step.column || step.step?.column;
    const stepValue = step.value || step.step?.value;

    switch (operation) {
      case "select_column":
      case "select":
        return { label: `Identified column: ${stepInput ?? "unknown"}`, status: "done" };
      case "aggregate":
        return { label: "Calculated sum", status: "done" };
      case "filter":
        return { label: `Applied filter: ${stepValue ?? "unknown"}`, status: "done" };
      case "sum":
        return { label: "Calculated sum", status: "done" };
      case "average":
        return { label: "Computed average", status: "done" };
      default:
        return { label: `Executed ${operation ?? "step"}`, status: "done" };
    }
  });
}
