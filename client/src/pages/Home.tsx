import { useState } from "react";
import { RibbonMenu } from "@/components/RibbonMenu";
import { SpreadsheetGrid } from "@/components/SpreadsheetGrid";
import { AgentSidebar } from "@/components/AgentSidebar";
import { FileExplorer } from "@/components/FileExplorer";
import { toast } from "sonner";

export default function Home() {
  const [activeTab, setActiveTab] = useState("home");
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);

  const handleRibbonAction = (action: string) => {
    toast.info(`Action: ${action}`);
  };

  const handleAgentAction = (action: string) => {
    toast.success(`Agent action: ${action}`);
  };

  const handleFileSelect = (fileId: string) => {
    toast.info(`File selected: ${fileId}`);
  };

  const handleUpload = () => {
    toast.info("Upload dialog would open here");
  };

  const handleCellChange = (row: number, col: number, value: string) => {
    console.log(`Cell [${row}, ${col}] changed to: ${value}`);
  };

  const handleCellSelect = (row: number, col: number) => {
    setSelectedCell({ row, col });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center">
            <span className="text-sm font-bold text-accent-foreground">SI</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">SACCO IDE</h1>
            <p className="text-xs text-muted-foreground">
              Agentic Financial Workspace for Kenya
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 bg-muted rounded">
            Status: Ready
          </span>
        </div>
      </div>

      {/* Ribbon Menu */}
      <RibbonMenu
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onAction={handleRibbonAction}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - File Explorer */}
        <div className="w-64 border-r border-border overflow-hidden">
          <FileExplorer onFileSelect={handleFileSelect} onUpload={handleUpload} />
        </div>

        {/* Center - Spreadsheet Grid */}
        <div className="flex-1 overflow-hidden">
          <SpreadsheetGrid
            rows={50}
            cols={10}
            onCellChange={handleCellChange}
            onCellSelect={handleCellSelect}
          />
        </div>

        {/* Right Sidebar - Agent */}
        <div className="w-80 border-l border-border overflow-hidden">
          <AgentSidebar onAction={handleAgentAction} />
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-sidebar text-xs text-muted-foreground">
        <div>
          {selectedCell
            ? `Cell: ${String.fromCharCode(65 + selectedCell.col)}${selectedCell.row}`
            : "Ready"}
        </div>
        <div className="flex items-center gap-4">
          <span>Rows: 50 | Columns: 10</span>
          <span>Auto Mode: Off</span>
        </div>
      </div>
    </div>
  );
}
