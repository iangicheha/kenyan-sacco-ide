import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  MessageCircle,
} from "lucide-react";

interface AgentMessage {
  id: string;
  type: "user" | "agent" | "action" | "error" | "success";
  content: string;
  timestamp: Date;
  actionButtons?: Array<{
    label: string;
    action: string;
  }>;
}

interface AgentSidebarProps {
  onAction?: (action: string) => void;
}

export function AgentSidebar({ onAction }: AgentSidebarProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "1",
      type: "agent",
      content:
        "Welcome to the SACCO IDE Agent. I can help you clean data, run audits, and generate SASRA reports. What would you like to do?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

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
      // Check if user is asking for      } else if (text.toLowerCase().includes("audit")) {
        const auditResponse = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!auditResponse.ok) {
          throw new Error("Audit failed");
        }

        const auditData = await auditResponse.json();
        const auditMessage: AgentMessage = {
          id: Date.now().toString(),
          type: "action",
          content: `Forensic Audit Complete! Found ${auditData.auditLogs.length} discrepancies. ${auditData.auditLogs.map((log: any) => `${log.memberId}: ${log.description}`).join(" | ")}`,
          timestamp: new Date(),
          actionButtons: [
            { label: "View Results", action: "view-audit" },
            { label: "Download Board Report", action: "download-report" },
          ],
        };
        setMessages((prev) => [...prev, auditMessage]);
      } else if (text.toLowerCase().includes("clean")) {
        const cleanMessage: AgentMessage = {
          id: Date.now().toString(),
          type: "action",
          content:
            "Cleaning data... Normalizing dates, removing duplicates, and fixing member IDs.",
          timestamp: new Date(),
          actionButtons: [
            { label: "Apply Changes", action: "apply-clean" },
            { label: "Preview", action: "preview-clean" },
          ],
        };
        setMessages((prev) => [...prev, cleanMessage]);
      } else if (text.toLowerCase().includes("sasra")) {
        const sasraMessage: AgentMessage = {
          id: Date.now().toString(),
          type: "action",
          content:
            "Generating SASRA Form 4... Calculating provisioning based on loan aging.",
          timestamp: new Date(),
          actionButtons: [
            { label: "Generate Form 4", action: "generate-form4" },
            { label: "Preview", action: "preview-form4" },
          ],
        };
        setMessages((prev) => [...prev, sasraMessage]);
      } else {
        const defaultMessage: AgentMessage = {
          id: Date.now().toString(),
          type: "agent",
          content: `I understand you want to: "${text}". How can I assist you further?`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, defaultMessage]);
      }
    } catch (error) {
      const errorMessage: AgentMessage = {
        id: Date.now().toString(),
        type: "error",
        content: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = async (action: string) => {
    onAction?.(action);

    if (action === "download-report") {
      try {
        const response = await fetch("/api/generate-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          throw new Error("Failed to generate report");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "Meridian_AI_Audit_Report.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        const successMessage: AgentMessage = {
          id: Date.now().toString(),
          type: "success",
          content: "Boardroom Report downloaded successfully!",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, successMessage]);
      } catch (error) {
        const errorMessage: AgentMessage = {
          id: Date.now().toString(),
          type: "error",
          content: `Error downloading report: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } else {
      // Add action confirmation message
      const confirmMessage: AgentMessage = {
        id: Date.now().toString(),
        type: "success",
        content: `Action "${action}" initiated successfully.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, confirmMessage]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-sidebar">
        <Zap className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold text-foreground">
          AI Agent
        </span>
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
                      ? "bg-accent text-accent-foreground"
                      : msg.type === "error"
                        ? "bg-destructive/20 text-destructive border border-destructive"
                        : msg.type === "success"
                          ? "bg-accent/20 text-accent border border-accent"
                          : msg.type === "action"
                            ? "bg-blue-900/30 text-blue-200 border border-blue-500"
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
                  {msg.type === "action" && (
                    <div className="flex items-center gap-2 mb-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="font-medium">Processing</span>
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>

              {/* Action Buttons */}
              {msg.actionButtons && msg.actionButtons.length > 0 && (
                <div className="flex gap-2 ml-2">
                  {msg.actionButtons.map((btn) => (
                    <Button
                      key={btn.action}
                      size="sm"
                      variant="outline"
                      onClick={() => handleActionClick(btn.action)}
                      className="text-xs"
                    >
                      {btn.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2 items-start">
              <div className="bg-muted text-muted-foreground px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Agent is thinking...</span>
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
          placeholder="Ask the agent..."
          className="flex-1 px-3 py-2 text-sm bg-input border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={isLoading}
        />
        <Button
          size="sm"
          onClick={() => handleSendMessage(inputValue)}
          disabled={isLoading || !inputValue.trim()}
          className="px-3"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 border-t border-border bg-card space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Quick Actions</p>
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start text-xs"
            onClick={() => handleSendMessage("Run audit")}
          >
            <MessageCircle className="w-3 h-3 mr-2" />
            Run Audit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start text-xs"
            onClick={() => handleSendMessage("Clean data")}
          >
            <MessageCircle className="w-3 h-3 mr-2" />
            Clean Data
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start text-xs"
            onClick={() => handleSendMessage("Generate SASRA Form 4")}
          >
            <MessageCircle className="w-3 h-3 mr-2" />
            SASRA Form 4
          </Button>
        </div>
      </div>
    </div>
  );
}
