/**
 * PendingOperationsPanel.tsx
 *
 * Phase 2: Core Agentic Loop - Pending Operations Queue UI
 *
 * Displays AI-proposed changes as cards with:
 * - Old value → New value with visual diff
 * - AI reasoning for the change
 * - Accept/Reject buttons per operation
 * - Accept All/Reject All batch actions
 * - Downstream impact warnings
 */

import { useState, useEffect } from "react";
import { authFetch } from "@/lib/authApi";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  FileSpreadsheet,
  FunctionSquare,
  Trash2,
  Loader2,
} from "lucide-react";

export interface PendingOperation {
  id: string;
  tool: string;
  address: string;
  sheet: string;
  oldValue: string | number | boolean | null;
  oldFormula: string | null;
  newValue: string | number | boolean | null;
  newFormula: string | null;
  rationale: string;
  affectedCells?: string[];
  operationType?: string;
  metadata?: {
    range?: { start: string; end: string };
    sourceCell?: string | null;
  };
}

interface PendingOperationsPanelProps {
  sessionId: string;
  onOperationAccepted?: (operation: PendingOperation) => void;
  onOperationRejected?: (operation: PendingOperation) => void;
}

export function PendingOperationsPanel({
  sessionId,
  onOperationAccepted,
  onOperationRejected,
}: PendingOperationsPanelProps) {
  const [operations, setOperations] = useState<PendingOperation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Fetch pending operations on mount and when sessionId changes
  useEffect(() => {
    fetchPendingOperations();
  }, [sessionId]);

  const fetchPendingOperations = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch(`/api/spreadsheet/pending/${encodeURIComponent(sessionId)}`);

      if (!response.ok) {
        throw new Error("Failed to fetch pending operations");
      }

      const result = await response.json();
      const pending = Array.isArray(result?.pendingOperations) ? result.pendingOperations : [];
      const mapped: PendingOperation[] = pending.map((op: any) => ({
        id: String(op.id),
        tool: String(op.kind ?? "write_formula"),
        address: String(op.cellRef ?? ""),
        sheet: "Sheet1",
        oldValue: op.oldValue ?? null,
        oldFormula: null,
        newValue: null,
        newFormula: op.formula ?? null,
        rationale: String(op.reasoning ?? ""),
        affectedCells: [],
      }));
      setOperations(mapped);
    } catch (error) {
      console.error("Error fetching pending operations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (operation: PendingOperation) => {
    setProcessingIds((prev) => new Set(prev).add(operation.id));
    try {
      const response = await authFetch("/api/spreadsheet/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: operation.id,
          analyst: "analyst@meridian.local",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to accept operation");
      }

      setOperations((prev) => prev.filter((op) => op.id !== operation.id));
      onOperationAccepted?.(operation);
    } catch (error) {
      console.error("Error accepting operation:", error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(operation.id);
        return next;
      });
    }
  };

  const handleReject = async (operation: PendingOperation) => {
    setProcessingIds((prev) => new Set(prev).add(operation.id));
    try {
      const response = await authFetch("/api/spreadsheet/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: operation.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject operation");
      }

      setOperations((prev) => prev.filter((op) => op.id !== operation.id));
      onOperationRejected?.(operation);
    } catch (error) {
      console.error("Error rejecting operation:", error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(operation.id);
        return next;
      });
    }
  };

  const handleAcceptAll = async () => {
    for (const op of operations) {
      await handleAccept(op);
    }
  };

  const handleRejectAll = async () => {
    for (const op of operations) {
      await handleReject(op);
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "(empty)";
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    return String(value);
  };

  const getToolIcon = (tool: string) => {
    switch (tool) {
      case "write_formula":
      case "apply_sasra_provisioning":
        return <FunctionSquare className="w-4 h-4" />;
      case "apply_to_range":
        return <FileSpreadsheet className="w-4 h-4" />;
      case "write_value":
        return <FileSpreadsheet className="w-4 h-4" />;
      default:
        return <FileSpreadsheet className="w-4 h-4" />;
    }
  };

  const getToolBadge = (tool: string) => {
    const labels: Record<string, string> = {
      write_value: "Value",
      write_formula: "Formula",
      apply_to_range: "Range",
      apply_sasra_provisioning: "SASRA",
      normalize_phone_column: "Normalize",
    };
    return labels[tool] || tool;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        <p className="text-sm">Loading pending operations...</p>
      </div>
    );
  }

  if (operations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <CheckCircle2 className="w-12 h-12 mb-3 text-green-500" />
        <p className="text-sm font-medium">No pending operations</p>
        <p className="text-xs mt-1">AI-proposed changes will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {operations.length}
          </Badge>
          <span className="text-sm font-medium">Pending Operations</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRejectAll}
            disabled={processingIds.size > 0}
            className="text-xs"
          >
            <XCircle className="w-3 h-3 mr-1" />
            Reject All
          </Button>
          <Button
            size="sm"
            onClick={handleAcceptAll}
            disabled={processingIds.size > 0}
            className="text-xs"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Accept All
          </Button>
        </div>
      </div>

      {/* Operations list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {operations.map((op) => (
            <Card
              key={op.id}
              className="border-l-4 border-l-yellow-500 hover:border-l-yellow-400 transition-colors"
            >
              <CardHeader className="py-3 px-4">
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {getToolIcon(op.tool)}
                    <span className="font-mono text-xs">
                      {op.sheet}:{op.address}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {getToolBadge(op.tool)}
                    </Badge>
                  </div>
                  {op.affectedCells && op.affectedCells.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {op.affectedCells.length} affected
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 px-4 pb-4">
                {/* Value diff */}
                <div className="bg-muted/50 rounded p-2 mb-3 font-mono text-xs">
                  {op.oldFormula || op.newFormula ? (
                    // Formula change
                    <div className="space-y-1">
                      {op.oldFormula && (
                        <div className="text-red-500 line-through">
                          {op.oldFormula}
                        </div>
                      )}
                      {op.newFormula && (
                        <div className="text-green-500">
                          {op.newFormula}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Value change
                    <div className="flex items-center gap-2">
                      <span className="text-red-500 line-through">
                        {formatValue(op.oldValue)}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-green-500">
                        {formatValue(op.newValue)}
                      </span>
                    </div>
                  )}
                </div>

                {/* AI Reasoning */}
                <div className="text-xs text-muted-foreground mb-3">
                  <span className="font-medium text-foreground">Reason:</span>{" "}
                  {op.rationale}
                </div>

                {/* Affected cells warning */}
                {op.affectedCells && op.affectedCells.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2 mb-3">
                    <p className="text-xs font-medium text-yellow-600 mb-1">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      Will affect {op.affectedCells.length} downstream cells
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {op.affectedCells.slice(0, 5).join(", ")}
                      {op.affectedCells.length > 5 && "..."}
                    </p>
                  </div>
                )}

                {/* Batch operation details */}
                {op.operationType && (
                  <div className="text-xs text-muted-foreground mb-2">
                    Operation: <span className="font-medium">{op.operationType}</span>
                    {op.metadata?.range && (
                      <span className="ml-2 font-mono">
                        {op.metadata.range.start}:{op.metadata.range.end}
                      </span>
                    )}
                  </div>
                )}

                <Separator className="my-3" />

                {/* Action buttons */}
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReject(op)}
                    disabled={processingIds.has(op.id)}
                    className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    {processingIds.has(op.id) ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <XCircle className="w-3 h-3 mr-1" />
                    )}
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(op)}
                    disabled={processingIds.has(op.id)}
                    className="text-xs"
                  >
                    {processingIds.has(op.id) ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      )}
                    Accept
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
