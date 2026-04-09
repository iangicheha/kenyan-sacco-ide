import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Filter,
  BarChart3,
  Shield,
  FileText,
  ChevronDown,
  Save,
  Undo2,
  Redo2,
  Share2,
} from "lucide-react";
import { useState } from "react";

interface RibbonMenuProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAction?: (action: string) => void;
}

export function RibbonMenu({
  activeTab,
  onTabChange,
  onAction,
}: RibbonMenuProps) {
  const [autoMode, setAutoMode] = useState(false);

  const tabs = [
    { id: "home", label: "Home" },
    { id: "insert", label: "Insert" },
    { id: "data", label: "Data" },
    { id: "audit", label: "Audit" },
    { id: "sasra", label: "SASRA" },
  ];

  return (
    <div className="flex flex-col border-b border-border bg-card">
      {/* Quick Access Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-sidebar">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction?.("save")}
          title="Save"
        >
          <Save className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction?.("undo")}
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction?.("redo")}
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction?.("share")}
          title="Share"
        >
          <Share2 className="w-4 h-4" />
        </Button>

        {/* Auto Mode Toggle */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Auto Mode</span>
          <button
            onClick={() => setAutoMode(!autoMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoMode ? "bg-accent" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Ribbon Tabs */}
      <div className="flex items-center gap-0 px-4 bg-card">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`ribbon-tab ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ribbon Content - Home Tab */}
      {activeTab === "home" && (
        <div className="flex items-center gap-4 px-4 py-3 border-t border-border bg-sidebar">
          {/* Font Formatting */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction?.("bold")}
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction?.("italic")}
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Alignment */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction?.("align-left")}
              title="Align Left"
            >
              <AlignLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction?.("align-center")}
              title="Align Center"
            >
              <AlignCenter className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAction?.("align-right")}
              title="Align Right"
            >
              <AlignRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* Number Format */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                Format <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onAction?.("format-currency")}>
                Currency (KES)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction?.("format-percent")}>
                Percentage
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction?.("format-number")}>
                Number
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction?.("format-date")}>
                Date
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Ribbon Content - Insert Tab */}
      {activeTab === "insert" && (
        <div className="flex items-center gap-4 px-4 py-3 border-t border-border bg-sidebar">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("insert-table")}
          >
            <Plus className="w-4 h-4 mr-2" />
            Table
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("insert-chart")}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Chart
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("insert-image")}
          >
            <Plus className="w-4 h-4 mr-2" />
            Image
          </Button>
        </div>
      )}

      {/* Ribbon Content - Data Tab */}
      {activeTab === "data" && (
        <div className="flex items-center gap-4 px-4 py-3 border-t border-border bg-sidebar">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("sort")}
          >
            Sort
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("filter")}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("clean-data")}
          >
            Clean Data
          </Button>
        </div>
      )}

      {/* Ribbon Content - Audit Tab */}
      {activeTab === "audit" && (
        <div className="flex items-center gap-4 px-4 py-3 border-t border-border bg-sidebar">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("forensic-check")}
          >
            <Shield className="w-4 h-4 mr-2" />
            Forensic Check
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("phantom-savings")}
          >
            Phantom Savings
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("ghost-accounts")}
          >
            Ghost Accounts
          </Button>
        </div>
      )}

      {/* Ribbon Content - SASRA Tab */}
      {activeTab === "sasra" && (
        <div className="flex items-center gap-4 px-4 py-3 border-t border-border bg-sidebar">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("form-4")}
          >
            <FileText className="w-4 h-4 mr-2" />
            Form 4 (Provisioning)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("form-1")}
          >
            Form 1 (Capital)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction?.("compliance-check")}
          >
            Compliance Check
          </Button>
        </div>
      )}
    </div>
  );
}
