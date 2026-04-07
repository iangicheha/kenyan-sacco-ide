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

  onClick,
  variant = 'secondary',
  isActive = false,
}: {
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  isActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip || label}
      className={`flex flex-col items-center justify-center px-3 py-2 rounded transition-all duration-150 ${
        isActive
          ? 'bg-gray-200'
          : 'hover:bg-gray-100 active:bg-gray-200'
      } group`}
      style={{
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: '14px',
        fontWeight: 500,
      }}
    >
      <Icon
        className={`w-5 h-5 mb-1 ${
          variant === 'primary' ? 'text-[#107C41]' : 'text-[#444]'
        } group-hover:opacity-80 transition-opacity`}
      />
      <span
        className="text-xs font-medium text-[#444] leading-tight whitespace-nowrap"
        style={{
          fontFamily: "'Segoe UI', Arial, sans-serif",
          fontSize: '11px',
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </button>
  );
}

// Ribbon Group Component
function RibbonGroup({
  label,
  items,
  onAction,
}: {
  label: string;
  items: RibbonItem[];
  onAction?: (actionId: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 border-r border-gray-300">
      <div className="flex gap-1">
        {items.map((item) => (
          <RibbonButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            tooltip={item.tooltip}
            onClick={() => {
              item.onClick();
              onAction?.(item.id);
            }}
            variant={item.variant}
          />
        ))}
      </div>
      <span
        className="text-xs text-gray-600 font-medium leading-tight mt-1"
        style={{
          fontFamily: "'Segoe UI', Arial, sans-serif",
          fontSize: '11px',
          fontWeight: 500,
          color: '#666',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// Tab Configuration
const RIBBON_TABS: RibbonTab[] = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'insert', label: 'Insert', icon: Plus },
  { id: 'page-layout', label: 'Page Layout', icon: Layout },
  { id: 'formulas', label: 'Formulas', icon: Zap },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'view', label: 'View', icon: Eye },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Ribbon Content Definitions
const RIBBON_CONTENT: Record<string, RibbonGroup[]> = {
  home: [
    {
      label: 'Clipboard',
      items: [
        {
          id: 'paste',
          label: 'Paste',
          icon: Copy,
          onClick: () => {},
          variant: 'primary',
        },
        {
          id: 'copy',
          label: 'Copy',
          icon: Copy,
          onClick: () => {},
        },
        {
          id: 'cut',
          label: 'Cut',
          icon: Scissors,
          onClick: () => {},
        },
      ],
    },
    {
      label: 'Font',
      items: [
        {
          id: 'bold',
          label: 'Bold',
          icon: Bold,
          onClick: () => {},
        },
        {
          id: 'italic',
          label: 'Italic',
          icon: Italic,
          onClick: () => {},
        },
        {
          id: 'underline',
          label: 'Underline',
          icon: Underline,
          onClick: () => {},
        },
      ],
    },
    {
      label: 'Alignment',
      items: [
        {
          id: 'align-left',
          label: 'Left',
          icon: AlignLeft,
          onClick: () => {},
        },
        {
          id: 'align-center',
          label: 'Center',
          icon: AlignCenter,
          onClick: () => {},
        },
        {
          id: 'align-right',
          label: 'Right',
          icon: AlignRight,
          onClick: () => {},
        },
      ],
    },
  ],
  insert: [
    {
      label: 'Elements',
      items: [
        {
          id: 'insert-image',
          label: 'Image',
          icon: ImageIcon,
          onClick: () => {},
        },
        {
          id: 'insert-chart',
          label: 'Chart',
          icon: BarChart3,
          onClick: () => {},
        },
        {
          id: 'insert-table',
          label: 'Table',
          icon: Grid3X3,
          onClick: () => {},
        },
      ],
    },
    {
      label: 'Text',
      items: [
        {
          id: 'insert-text-box',
          label: 'Text Box',
          icon: FileText,
          onClick: () => {},
        },
        {
          id: 'insert-comment',
          label: 'Comment',
          icon: PencilLine,
          onClick: () => {},
        },
      ],
    },
  ],
  'page-layout': [
    {
      label: 'Page Setup',
      items: [
        {
          id: 'margins',
          label: 'Margins',
          icon: Layout,
          onClick: () => {},
        },
        {
          id: 'orientation',
          label: 'Orientation',
          icon: Grid3X3,
          onClick: () => {},
        },
      ],
    },
    {
      label: 'Sheet Options',
      items: [
        {
          id: 'grid-lines',
          label: 'Grid Lines',
          icon: Database,
          onClick: () => {},
        },
      ],
    },
  ],
  formulas: [
    {
      label: 'Function Library',
      items: [
        {
          id: 'sum',
          label: 'Sum',
          icon: Plus,
          onClick: () => {},
        },
        {
          id: 'avg',
          label: 'Average',
          icon: BarChart3,
          onClick: () => {},
        },
      ],
    },
  ],
  data: [
    {
      label: 'Get & Transform',
      items: [
        {
          id: 'import-data',
          label: 'Import',
          icon: DownloadCloud,
          onClick: () => {},
        },
      ],
    },
    {
      label: 'Sort & Filter',
      items: [
        {
          id: 'filter',
          label: 'Filter',
          icon: Filter,
          onClick: () => {},
        },
      ],
    },
  ],
  view: [
    {
      label: 'Views',
      items: [
        {
          id: 'normal-view',
          label: 'Normal',
          icon: Eye,
          onClick: () => {},
        },
        {
          id: 'page-break',
          label: 'Page Break',
          icon: Layout,
          onClick: () => {},
        },
      ],
    },
  ],
  settings: [
    {
      label: 'Options',
      items: [
        {
          id: 'preferences',
          label: 'Preferences',
          icon: Settings,
          onClick: () => {},
        },
        {
          id: 'more-options',
          label: 'More',
          icon: MoreHorizontal,
          onClick: () => {},
        },
      ],
    },
  ],
};

// Main Ribbon Component
export function RibbonMenu({
  activeTab = 'home',
  onTabChange,
  onAction,
}: RibbonMenuProps) {
  const [currentTab, setCurrentTab] = useState(activeTab);

  const handleTabChange = (tabId: string) => {
    setCurrentTab(tabId);
    onTabChange?.(tabId);
  };

  const currentContent = RIBBON_CONTENT[currentTab] || [];

  return (
    <div
      className="flex flex-col w-full border-b shadow-md"
      style={{
        backgroundColor: '#f3f3f3',
        borderColor: '#d0d0d0',
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* Tab Bar - Excel-style tabs */}
      <div className="flex items-center w-full border-b" style={{ borderColor: '#d0d0d0' }}>
        {RIBBON_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-5 py-2 text-sm font-medium transition-all duration-200 border-b-2 ${
              currentTab === tab.id
                ? 'text-white'
                : 'text-[#444] hover:bg-[#e6e6e6]'
            }`}
            style={{
              borderBottomColor: currentTab === tab.id ? '#107C41' : 'transparent',
              backgroundColor: currentTab === tab.id ? '#107C41' : 'transparent',
              fontFamily: "'Segoe UI', Arial, sans-serif",
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {tab.label}
          </button>
        ))}
        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* Ribbon Content - Dynamic based on active tab */}
      <div
        className="flex items-center gap-0 px-2 py-3 overflow-x-auto"
        style={{
          backgroundColor: '#f3f3f3',
          minHeight: '100px',
        }}
      >
        {currentContent.length > 0 ? (
          currentContent.map((group, index) => (
            <RibbonGroup
              key={`${currentTab}-group-${index}`}
              label={group.label}
              items={group.items}
              onAction={onAction}
            />
          ))
        ) : (
          <div className="flex items-center justify-center w-full h-24 text-gray-400">
            <span style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
              No tools available for this tab
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default RibbonMenu;
