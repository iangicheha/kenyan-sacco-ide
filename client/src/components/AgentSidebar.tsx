/**
 * AgentSidebar.tsx
 *
 * Phase 2: Core Agentic Loop - Connected to real tRPC endpoints
 *
 * REMOVED: All hardcoded mock responses
 * ADDED: Real tRPC calls to backend AI pipeline
 */

import { useState, useRef, useEffect } from "react";
import { authFetch } from "@/lib/authApi";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  MessageCircle,
  Terminal,
  FileSpreadsheet,
} from "lucide-react";

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  rationale: string;
}

export interface CellLink {
  label: string;
  address: string;
  sheet: string;
  tooltip: string;
}

export interface AgentMessage {
  id: string;
  type: "user" | "agent" | "action" | "error" | "success" | "tool";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  cellLinks?: CellLink[];
  operations?: Array<{
    id: string;
    tool: string;
    address: string;
    rationale: string;
  }>;
  executionTrace?: {
    plan: Array<{ step: number; action: string; description: string }>;
    execution: Array<{ step: number; operation: string; input: unknown; output: unknown }>;
    result: number | string;
  };
}

interface AgentSidebarProps {
  sessionId: string;
  onAction?: (action: string, payload?: unknown) => void;
  onCellClick?: (address: string, sheet: string) => void;
}

export function AgentSidebar({
  sessionId,
  onAction,
  onCellClick,
}: AgentSidebarProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !sessionId) return;

    // Add user message
    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      type: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // REAL API CALL to tRPC endpoint
      const response = await authFetch(
        "/api/trpc/spreadsheet.chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: text,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Request failed: ${response.status}`
        );
      }

      const result = await response.json();
      const data = result.result?.data;

      if (!data) {
        throw new Error("Invalid response from server");
      }

      // Parse the AI response (it's a JSON string in the message field)
      let aiResponse: AgentMessage;
      try {
        const parsedMessage = JSON.parse(data.message);

        aiResponse = {
          id: (Date.now() + 1).toString(),
          type: parsedMessage.result?.startsWith("ERROR") ? "error" : "agent",
          content: formatAIResponse(parsedMessage),
          timestamp: new Date(),
          executionTrace: parsedMessage.trace || undefined,
          operations: data.operations || [],
          cellLinks: data.cellLinks || [],
        };
      } catch {
        // Fallback if message is not JSON
        aiResponse = {
          id: (Date.now() + 1).toString(),
          type: "agent",
          content: data.message || "No response",
          timestamp: new Date(),
        };
      }

      setMessages((prev) => [...prev, aiResponse]);

      // Trigger refresh of pending operations panel
      if (data.operations?.length > 0) {
        onAction?.("operations_updated", data.operations);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: AgentMessage = {
        id: (Date.now() + 1).toString(),
        type: "error",
        content:
          error instanceof Error
            ? error.message
            : "Failed to get response from AI",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAIResponse = (parsed: {
    query?: string;
    plan?: Array<{ step: number; action: string; description: string }>;
    execution?: Array<{
      step: number;
      operation: string;
      input: unknown;
      output: unknown;
    }>;
    result?: number | string;
  }): string => {
    if (parsed.result?.toString().startsWith("ERROR")) {
      return `❌ ${parsed.result}`;
    }

    let response = "**Query:** " + (parsed.query || "Unknown") + "\n\n";

    if (parsed.plan?.length) {
      response += "**Plan:**\n";
      parsed.plan.forEach((step) => {
        response += `${step.step}. ${step.action}: ${step.description}\n`;
      });
      response += "\n";
    }

    if (parsed.execution?.length) {
      response += "**Execution:**\n";
      parsed.execution.forEach((step) => {
        response += `${step.step}. ${step.operation}: ${JSON.stringify(
          step.output
        )}\n`;
      });
      response += "\n";
    }

    if (parsed.result !== undefined) {
      response += `**Result:** ${parsed.result}`;
    }

    return response;
  };

  const handleQuickAction = async (action: string) => {
    const prompts: Record<string, string> = {
      audit: "Run a forensic audit on the current spreadsheet. Detect ghost accounts, phantom savings, and data anomalies.",
      clean: "Clean the data: normalize phone numbers, standardize dates, and remove duplicates.",
      sasra: "Generate SASRA Form 4 loan loss provisioning report based on loan aging data.",
      provisioning: "Calculate loan loss provisioning for all overdue loans using CBK/SASRA guidelines.",
    };

    const prompt = prompts[action];
    if (prompt) {
      await handleSendMessage(prompt);
    }
    onAction?.(action);
  };

  const renderMessageContent = (msg: AgentMessage) => {
    if (msg.executionTrace) {
      return (
        <div className="space-y-2">
          <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
          {msg.operations && msg.operations.length > 0 && (
            <div className="mt-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
              <div className="text-xs font-medium text-yellow-600 mb-1">
                📋 {msg.operations.length} pending operation(s) await approval
              </div>
              <div className="text-xs text-muted-foreground">
                Check the Pending Operations panel to review and accept/reject.
              </div>
            </div>
          )}
          {msg.cellLinks && msg.cellLinks.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {msg.cellLinks.map((link) => (
                <Badge
                  key={link.address}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => onCellClick?.(link.address, link.sheet)}
                  title={link.tooltip}
                >
                  {link.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-foreground">
            AI Agent
          </span>
        </div>
        {sessionId && (
          <Badge variant="outline" className="text-xs font-mono">
            {sessionId.slice(0, 8)}
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-4" ref={scrollRef}>
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <div
                className={`flex gap-2 ${
                  msg.type === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    msg.type === "user"
                      ? "bg-muted text-foreground border border-border"
                      : msg.type === "error"
                      ? "bg-destructive/20 text-destructive border border-destructive"
                      : msg.type === "success"
                      ? "bg-green-500/20 text-green-500 border border-green-500"
                      : msg.type === "tool"
                      ? "bg-muted text-foreground border border-border"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {msg.type === "error" && (
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">Error</span>
                    </div>
                  )}
                  {msg.type === "success" && (
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium">Success</span>
                    </div>
                  )}
                  {msg.type === "tool" && (
                    <div className="flex items-center gap-2 mb-1">
                      <Terminal className="w-4 h-4" />
                      <span className="font-medium">Tool Call</span>
                    </div>
                  )}
                  {renderMessageContent(msg)}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2 items-start">
              <div className="bg-muted text-muted-foreground px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Agent is reasoning...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex gap-2 px-4 py-3 border-t border-border bg-sidebar">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !isLoading) {
              handleSendMessage(inputValue);
            }
          }}
          placeholder={
            sessionId
              ? "Ask the agent..."
              : "Create a session first..."
          }
          className="flex-1 px-3 py-2 text-sm bg-input border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={isLoading || !sessionId}
        />
        <Button
          size="sm"
          onClick={() => handleSendMessage(inputValue)}
          disabled={isLoading || !inputValue.trim() || !sessionId}
          className="px-3"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 border-t border-border bg-card space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start text-xs"
            onClick={() => handleQuickAction("audit")}
            disabled={!sessionId || isLoading}
          >
            <Terminal className="w-3 h-3 mr-2" />
            Run Audit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start text-xs"
            onClick={() => handleQuickAction("clean")}
            disabled={!sessionId || isLoading}
          >
            <FileSpreadsheet className="w-3 h-3 mr-2" />
            Clean Data
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start text-xs"
            onClick={() => handleQuickAction("sasra")}
            disabled={!sessionId || isLoading}
          >
            <MessageCircle className="w-3 h-3 mr-2" />
            SASRA Form 4
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start text-xs"
            onClick={() => handleQuickAction("provisioning")}
            disabled={!sessionId || isLoading}
          >
            <Zap className="w-3 h-3 mr-2" />
            Provisioning
          </Button>
        </div>
      </div>
    </div>
  );
}
