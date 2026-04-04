import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Clipboard,
  Palette,
  Settings,
  ChevronDown,
  Plus,
  Save,
  FileText,
  Folder,
  File,
  Grid3x3,
  BarChart3,
  Filter,
  Link as LinkIcon,
  MessageSquare,
  Type,
  Zap,
  Eye,
  Maximize2,
  ZoomIn,
  Share2,
  BookOpen,
  Lightbulb,
  Layers,
  Home as HomeIcon,
  Maximize,
  Download,
  Upload,
  Play,
} from 'lucide-react';

/**
 * Kenyan SACCO IDE - Microsoft Word-Style Interface
 * 
 * Layout:
 * - Left: Username + Directory Tree
 * - Top: SACCO IDE Title (center) + Ribbon Menu + Notes/Save (right)
 * - Center: Dynamic content viewer (PDF, Excel, Word, Text)
 * - Right: Agent sidebar (optional)
 */

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedFile, setSelectedFile] = useState('Trial Balance - January 2026');
  const [fileType, setFileType] = useState('excel'); // 'excel', 'pdf', 'word', 'text'
  const [splitView, setSplitView] = useState(false);

  const handleFileSelect = (file: string, type: string) => {
    setSelectedFile(file);
    setFileType(type);
  };

  // Ribbon menu items for each tab
  const ribbonItems = {
    home: [
      { label: 'Clipboard', icon: Clipboard, items: ['Paste', 'Cut', 'Copy'] },
      { label: 'Font', icon: Type, items: ['Font', 'Size', 'Bold', 'Italic', 'Underline'] },
      { label: 'Alignment', icon: AlignLeft, items: ['Left', 'Center', 'Right', 'Justify'] },
      { label: 'Number', icon: Grid3x3, items: ['Format', 'Decimal', 'Percent', 'Currency'] },
      { label: 'Cells', icon: Grid3x3, items: ['Insert', 'Delete', 'Format'] },
      { label: 'Paragraph', icon: BookOpen, items: ['Spacing', 'Indent', 'Line Spacing'] },
      { label: 'Styles', icon: Palette, items: ['Normal', 'Heading 1', 'Heading 2'] },
      { label: 'Editing', icon: FileText, items: ['Find', 'Replace', 'Select'] },
    ],
    insert: [
      { label: 'Pages', icon: FileText, items: ['Page Break', 'Cover Page'] },
      { label: 'Tables', icon: Grid3x3, items: ['Table', 'Draw Table'] },
      { label: 'Illustrations', icon: Maximize, items: ['Pictures', 'Shapes', 'Icons'] },
      { label: 'Charts', icon: BarChart3, items: ['Column', 'Line', 'Pie'] },
      { label: 'Sparklines', icon: Zap, items: ['Line', 'Column', 'Win/Loss'] },
      { label: 'Filters', icon: Filter, items: ['AutoFilter', 'Standard Filter'] },
      { label: 'Media', icon: Play, items: ['Video', 'Audio'] },
      { label: 'Links', icon: LinkIcon, items: ['Hyperlink', 'Bookmark'] },
      { label: 'Comments', icon: MessageSquare, items: ['New Comment'] },
      { label: 'Text', icon: Type, items: ['Text Box', 'WordArt'] },
      { label: 'Symbols', icon: Zap, items: ['Equation', 'Symbol'] },
      { label: 'Header & Footer', icon: BookOpen, items: ['Header', 'Footer'] },
    ],
    layout: [
      { label: 'Page Setup', icon: Settings, items: ['Margins', 'Orientation', 'Size'] },
      { label: 'Paragraph', icon: BookOpen, items: ['Spacing', 'Indent', 'Alignment'] },
      { label: 'Arrange', icon: Layers, items: ['Bring Forward', 'Send Backward'] },
    ],
    formulas: [
      { label: 'Function Libraries', icon: Zap, items: ['Financial', 'Logical', 'Text'] },
      { label: 'Defined Names', icon: Settings, items: ['Define Name', 'Name Manager'] },
      { label: 'Formula Auditing', icon: Eye, items: ['Trace Precedents', 'Trace Dependents'] },
      { label: 'Calculation', icon: Grid3x3, items: ['Calculate Now', 'Calculate Sheet'] },
    ],
    data: [
      { label: 'Get & Transform Data', icon: Upload, items: ['From File', 'From Database'] },
      { label: 'Queries & Connections', icon: LinkIcon, items: ['New Query', 'Manage Connections'] },
      { label: 'Sort & Filter', icon: Filter, items: ['Sort', 'AutoFilter', 'Advanced Filter'] },
      { label: 'Data Tools', icon: Grid3x3, items: ['Text to Columns', 'Remove Duplicates'] },
      { label: 'Forecast', icon: BarChart3, items: ['Forecast Sheet'] },
      { label: 'Outline', icon: Layers, items: ['Group', 'Ungroup'] },
    ],
    view: [
      { label: 'Views', icon: Eye, items: ['Normal', 'Page Break Preview'] },
      { label: 'Immersive', icon: Maximize2, items: ['Focus Mode', 'Full Screen'] },
      { label: 'Page Movement', icon: ChevronDown, items: ['Previous', 'Next'] },
      { label: 'Show', icon: Eye, items: ['Ruler', 'Gridlines', 'Navigation Pane'] },
      { label: 'Zoom', icon: ZoomIn, items: ['Zoom In', 'Zoom Out', 'Fit Page'] },
      { label: 'Window', icon: Maximize, items: ['New Window', 'Arrange All'] },
      { label: 'Macros', icon: Zap, items: ['Record Macro', 'Play Macro'] },
      { label: 'SharePoint', icon: Share2, items: ['Share', 'Sync'] },
    ],
    settings: [
      { label: 'Options', icon: Settings, items: ['General', 'Display', 'Advanced'] },
      { label: 'Preferences', icon: Settings, items: ['Theme', 'Language'] },
    ],
  };

  const RibbonGroup = ({ label, icon: Icon, items }: any) => (
    <div className="flex flex-col items-center gap-1 px-3 py-2 border-r border-slate-600">
      <button className="flex flex-col items-center gap-1 hover:bg-slate-700 p-2 rounded">
        <Icon className="w-5 h-5 text-slate-300" />
        <span className="text-xs text-slate-300 text-center">{label}</span>
      </button>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      {/* Top Header - Title and Quick Actions */}
      <div className="bg-slate-950 border-b border-slate-700 px-6 py-2 flex items-center justify-between">
        <div className="flex-1 text-center">
          <h1 className="text-sm font-semibold text-slate-300">SACCO IDE - Book 1</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-slate-400 hover:text-white"
            onClick={() => setSplitView(!splitView)}
          >
            Arrange Split View
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-slate-400 hover:text-white"
          >
            📝 Notes
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
          >
            <Save className="w-3 h-3 mr-1" /> Save
          </Button>
        </div>
      </div>

      {/* Ribbon Menu */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-transparent border-b border-slate-600 w-full justify-start gap-0 rounded-none h-auto p-0">
            {['home', 'insert', 'layout', 'formulas', 'data', 'view', 'settings'].map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-none px-4 py-2 text-xs font-medium capitalize"
              >
                {tab === 'layout' ? 'Page Layout' : tab === 'formulas' ? 'Formulas' : tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Ribbon Content */}
          {Object.entries(ribbonItems).map(([tabName, items]: any) => (
            <TabsContent key={tabName} value={tabName} className="mt-0 p-0">
              <div className="bg-slate-750 border-b border-slate-600 px-4 py-2 flex gap-1 overflow-x-auto">
                {items.map((item: any, idx: number) => (
                  <RibbonGroup
                    key={idx}
                    label={item.label}
                    icon={item.icon}
                    items={item.items}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - File Explorer */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
          {/* Username */}
          <div className="p-4 border-b border-slate-700">
            <p className="text-sm font-semibold text-slate-300">Ian Gicheha</p>
            <p className="text-xs text-slate-500 mt-1">SACCO Manager</p>
          </div>

          {/* Directory */}
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Directory</h3>
          </div>

          {/* File Tree */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {[
                { name: 'Trial Balance - January 2026', type: 'excel', icon: Grid3x3 },
                { name: 'M-Pesa Statements', type: 'pdf', icon: FileText },
                { name: 'Member Register', type: 'excel', icon: Grid3x3 },
                { name: 'Loan Listing', type: 'excel', icon: Grid3x3 },
                { name: 'SASRA Form 4', type: 'word', icon: FileText },
                { name: 'Audit Report', type: 'pdf', icon: FileText },
              ].map((file, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs ${
                    selectedFile === file.name
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  onClick={() => handleFileSelect(file.name, file.type)}
                >
                  <file.icon className="w-4 h-4" />
                  <span className="truncate">{file.name}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Center - Dynamic Content Viewer */}
        <div className="flex-1 bg-slate-900 overflow-auto p-8">
          {fileType === 'excel' && (
            <div className="max-w-6xl mx-auto bg-white text-slate-900 rounded-lg shadow-lg p-8">
              <h1 className="text-2xl font-bold mb-4">{selectedFile}</h1>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-slate-300 px-4 py-2 text-left">Account</th>
                    <th className="border border-slate-300 px-4 py-2 text-right">Debit</th>
                    <th className="border border-slate-300 px-4 py-2 text-right">Credit</th>
                    <th className="border border-slate-300 px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { account: 'Cash', debit: '50,000', credit: '0', balance: '50,000' },
                    { account: 'Bank Account', debit: '150,000', credit: '0', balance: '150,000' },
                    { account: 'Member Loans', debit: '500,000', credit: '0', balance: '500,000' },
                    { account: 'Savings Account', debit: '0', credit: '600,000', balance: '600,000' },
                    { account: 'Operating Expenses', debit: '25,000', credit: '0', balance: '25,000' },
                  ].map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="border border-slate-300 px-4 py-2 font-medium">{row.account}</td>
                      <td className="border border-slate-300 px-4 py-2 text-right">{row.debit}</td>
                      <td className="border border-slate-300 px-4 py-2 text-right">{row.credit}</td>
                      <td className="border border-slate-300 px-4 py-2 text-right font-semibold">{row.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {fileType === 'pdf' && (
            <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-lg shadow-lg p-8">
              <h1 className="text-2xl font-bold mb-4">{selectedFile}</h1>
              <div className="bg-slate-100 h-96 rounded flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">PDF Preview</p>
                  <p className="text-xs text-slate-500 mt-2">M-Pesa Statement - January 2026</p>
                </div>
              </div>
            </div>
          )}

          {fileType === 'word' && (
            <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-lg shadow-lg p-8">
              <h1 className="text-2xl font-bold mb-4">{selectedFile}</h1>
              <div className="space-y-4 text-sm leading-relaxed">
                <p>
                  <strong>SASRA Form 4 - Risk Classification of Assets and Provisioning</strong>
                </p>
                <p>
                  This form provides a comprehensive analysis of the SACCO's loan portfolio, including risk classification
                  and required provisioning amounts.
                </p>
                <h2 className="text-lg font-semibold mt-6">Loan Portfolio Summary</h2>
                <ul className="list-disc list-inside space-y-2">
                  <li>Total Loans Outstanding: KES 5,000,000</li>
                  <li>Non-Performing Loans: KES 250,000 (5%)</li>
                  <li>Required Provisioning: KES 187,500</li>
                  <li>Compliance Status: COMPLIANT</li>
                </ul>
              </div>
            </div>
          )}

          {fileType === 'text' && (
            <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-lg shadow-lg p-8">
              <h1 className="text-2xl font-bold mb-4">{selectedFile}</h1>
              <pre className="text-xs bg-slate-100 p-4 rounded overflow-auto max-h-96">
{`Member ID,Name,Loan Amount,Status,Days Overdue
1001,John Doe,50000,Active,0
1002,Jane Smith,75000,Active,0
1003,Peter Johnson,100000,Overdue,45
1004,Mary Williams,60000,Overdue,90
1005,David Brown,80000,Active,0`}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
        <div>Ready</div>
        <div className="flex items-center gap-4">
          <span>File: {selectedFile}</span>
          <span>Type: {fileType.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
