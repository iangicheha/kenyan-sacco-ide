export type InstitutionType = "bank" | "sacco" | "mfi";
export type Regulator = "CBK" | "SASRA" | "IRA" | "RBA" | "CMA";
export type IntentName =
  | "calculate_provisioning"
  | "classify_loans"
  | "generate_report"
  | "analyze_portfolio"
  | "validate_data"
  | "compute_ratios"
  | "forecast"
  | "unknown";

export interface SheetColumn {
  name: string;
  type: "number" | "text" | "date" | "boolean" | "unknown";
}

export interface SheetSchema {
  name: string;
  columns: SheetColumn[];
  rowCount: number;
}

export interface SessionContext {
  sessionId: string;
  institutionType: InstitutionType;
  regulator: Regulator;
  sheets: SheetSchema[];
}

export interface IntentResult {
  intent: IntentName;
  scope: "single_cell" | "column_range" | "sheet_range" | "unknown";
  regulation: Regulator;
  confidence: number;
}

export interface PlannerAction {
  step: number;
  action: "read_column" | "write_formula" | "write_value";
  target: string;
  formula?: string;
  value?: string | number | boolean | null;
  reasoning: string;
  regulationReference?: string;
}

export interface PlannerResult {
  plan: PlannerAction[];
}

export interface FormulaValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

export interface PendingOperation {
  id: string;
  tenantId: string;
  sessionId: string;
  cellRef: string;
  kind: "formula" | "value";
  formula?: string;
  value?: string | number | boolean | null;
  oldValue: string | number | boolean | null;
  newValuePreview: string;
  reasoning: string;
  regulationReference?: string;
  confidence: number;
  policyVersion?: string;
  policyId?: string;
  evidenceText?: string;
  sourceDocument?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

export interface AuditLogEntry {
  tenantId: string;
  operationId: string;
  sessionId: string;
  cellRef: string;
  formulaApplied?: string;
  valuesWritten: Array<string | number | boolean | null>;
  analyst: string;
  timestamp: string;
  aiReasoning: string;
  correlationId?: string;
  policyVersion?: string;
  policyId?: string;
  evidenceText?: string;
  sourceDocument?: string;
}
