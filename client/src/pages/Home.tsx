import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Clipboard,
  Settings,
  ChevronDown,
  Plus,
  Save,
  FileText,
  Grid3x3,
  BarChart3,
  Filter,
  Zap,
  Eye,
  ZoomIn,
  Share2,
  Download,
  Upload,
  Play,
  Trash2,
  Send,
  Sparkles,
  TrendingUp,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/**
 * Kenyan SACCO IDE - Excel & Word Document Viewers
 * 
 * Features:
 * - Excel: Full spreadsheet with columns, rows, formula bar, cell editing
 * - Word: Document view with page layout and text editing
 * - Collaboration: User and AI work together in real-time
 */

// Sample Excel Data
const EXCEL_DATA = {
  'Trial Balance - January 2026': [
    { A: 'Account', B: 'Debit', C: 'Credit', D: 'Balance' },
    { A: 'Cash', B: '50000', C: '0', D: '=B2-C2' },
    { A: 'Bank Account', B: '150000', C: '0', D: '=B3-C3' },
    { A: 'Member Loans', B: '500000', C: '0', D: '=B4-C4' },
    { A: 'Savings Account', B: '0', C: '600000', D: '=B5-C5' },
    { A: 'Operating Expenses', B: '25000', C: '0', D: '=B6-C6' },
  ],
};

export default function Home() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedFile, setSelectedFile] = useState('Trial Balance - January 2026');
  const [fileType, setFileType] = useState('excel');
  const [selectedCell, setSelectedCell] = useState('A1');
  const [cellValue, setCellValue] = useState('');
  const [excelData, setExcelData] = useState(EXCEL_DATA['Trial Balance - January 2026']);
  const [wordContent, setWordContent] = useState('Financial Report - January 2026\n\nThis is a sample document...');
  const [agentMessages, setAgentMessages] = useState([
    {
      type: 'agent',
      text: 'I\'m ready to help. You can edit cells and I\'ll suggest improvements.',
      timestamp: new Date(),
    },
  ]);
  const [agentInput, setAgentInput] = useState('');

  const handleFileSelect = (file: string, type: string) => {
    setSelectedFile(file);
    setFileType(type);
    setSelectedCell('A1');
  };

  const handleCellClick = (row: number, col: string) => {
    const cellId = `${col}${row}`;
    setSelectedCell(cellId);
    const data = excelData[row - 1] as any;
    setCellValue(data?.[col] || '');
  };

  const handleCellChange = (value: string) => {
    setCellValue(value);
    const row = parseInt(selectedCell.slice(1)) - 1;
    const col = selectedCell.slice(0, 1);
    const newData = [...excelData];
    if (newData[row]) {
      (newData[row] as any)[col] = value;
      setExcelData(newData);
    }
  };

  const handleSendMessage = () => {
    if (agentInput.trim()) {
      setAgentMessages([
        ...agentMessages,
        { type: 'user', text: agentInput, timestamp: new Date() },
      ]);
      setAgentInput('');
      setTimeout(() => {
        setAgentMessages((prev) => [
          ...prev,
          {
            type: 'agent',
            text: 'I found an issue in row 5. The formula should be =B5-C5. Let me fix it.',
            timestamp: new Date(),
          },
        ]);
      }, 800);
    }
  };

  const RibbonButton = ({ icon: Icon, label, onClick }: any) => (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-2 py-1.5 rounded hover:bg-blue-50 transition-colors group"
      title={label}
    >
      <Icon className="w-4 h-4 text-slate-600 group-hover:text-blue-600" />
      <span className="text-xs text-slate-500 group-hover:text-slate-700 text-center max-w-12 leading-tight">
        {label}
      </span>
    </button>
  );

  const RibbonGroup = ({ title, children }: any) => (
    <div className="flex flex-col items-center gap-2 px-3 py-2 border-r border-slate-200">
      <div className="flex gap-0.5">{children}</div>
      <span className="text-xs text-slate-500 font-medium">{title}</span>
    </div>
  );

  // EXCEL VIEWER
  const ExcelViewer = () => (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Formula Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <div className="min-w-16 px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono text-slate-900">
          {selectedCell}
        </div>
        <span className="text-slate-500">fx</span>
        <Input
          value={cellValue}
          onChange={(e) => handleCellChange(e.target.value)}
          placeholder="Enter value or formula"
          className="flex-1 bg-white border-slate-200 text-sm"
        />
      </div>

      {/* Spreadsheet Grid */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse">
          <thead>
            <tr className="bg-slate-100 sticky top-0">
              <th className="w-12 h-8 border border-slate-300 bg-slate-100 text-center text-xs text-slate-600 font-semibold"></th>
              {['A', 'B', 'C', 'D', 'E', 'F'].map((col) => (
                <th
                  key={col}
                  className="w-24 h-8 border border-slate-300 bg-slate-100 text-center text-xs text-slate-600 font-semibold"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {excelData.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td className="w-12 h-8 border border-slate-300 bg-slate-100 text-center text-xs text-slate-600 font-semibold">
                  {rowIdx + 1}
                </td>
                {['A', 'B', 'C', 'D', 'E', 'F'].map((col) => {
                  const isSelected = selectedCell === `${col}${rowIdx + 1}`;
                  const cellData = (row as any)[col];
                  return (
                    <td
                      key={`${col}${rowIdx}`}
                      onClick={() => handleCellClick(rowIdx + 1, col)}
                      className={`w-24 h-8 border border-slate-300 px-2 text-xs cursor-cell font-mono ${
                        isSelected
                          ? 'bg-blue-100 border-blue-500 outline-2 outline-blue-600'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      {cellData || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 text-xs text-slate-600 flex justify-between">
        <span>Ready</span>
        <span>{selectedCell}</span>
      </div>
    </div>
  );

  // WORD VIEWER
  const WordViewer = () => (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Page Controls */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-slate-600">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-600">Page 1</span>
          <Button size="sm" variant="ghost" className="text-slate-600">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-slate-600">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-600">100%</span>
        </div>
      </div>

      {/* Document */}
      <div className="flex-1 overflow-auto p-8 flex items-start justify-center">
        <div className="bg-white w-full max-w-3xl shadow-lg p-12 min-h-full">
          <textarea
            value={wordContent}
            onChange={(e) => setWordContent(e.target.value)}
            className="w-full h-full border-0 resize-none focus:outline-none text-sm leading-relaxed font-serif"
            style={{ fontFamily: 'Georgia, serif' }}
          />
        </div>
      </div>
    </div>
  );

  // PDF VIEWER
  const PdfViewer = () => (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <span className="text-xs text-slate-600">PDF Preview</span>
        <Button size="sm" variant="ghost" className="text-slate-600">
          <Download className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
        <div className="bg-white w-full max-w-3xl shadow-lg p-12 text-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">{selectedFile}</p>
          <p className="text-slate-500 text-sm mt-2">PDF Document</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900">
      {/* Premium Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
            SI
          </div>
          <h1 className="text-sm font-semibold text-slate-900">SACCO IDE</h1>
        </div>

        <div className="flex items-center gap-3">
          <Input
            placeholder="Search files..."
            className="w-48 bg-slate-100 border-0 text-sm placeholder:text-slate-400 focus:bg-white"
          />
          <Button size="sm" variant="ghost" className="text-slate-600 hover:text-blue-600 hover:bg-blue-50">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Save className="w-4 h-4" /> Save
          </Button>
        </div>
      </div>

      {/* Modern Ribbon Menu */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 overflow-x-auto shadow-sm">
        <div className="flex items-center gap-1 mb-2">
          {['home', 'insert', 'layout', 'formulas', 'data', 'view'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'layout' ? 'Page Layout' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Ribbon Content */}
        {activeTab === 'home' && (
          <div className="flex gap-0.5 pb-2">
            <RibbonGroup title="Clipboard">
              <RibbonButton icon={Clipboard} label="Paste" />
              <RibbonButton icon={Copy} label="Copy" />
            </RibbonGroup>
            <RibbonGroup title="Font">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1">
                    Calibri <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-white border-slate-200">
                  <DropdownMenuItem>Arial</DropdownMenuItem>
                  <DropdownMenuItem>Times New Roman</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <RibbonButton icon={Bold} label="Bold" />
              <RibbonButton icon={Italic} label="Italic" />
              <RibbonButton icon={Underline} label="Underline" />
            </RibbonGroup>
            <RibbonGroup title="Alignment">
              <RibbonButton icon={AlignLeft} label="Left" />
              <RibbonButton icon={AlignCenter} label="Center" />
              <RibbonButton icon={AlignRight} label="Right" />
            </RibbonGroup>
            <RibbonGroup title="Tools">
              <RibbonButton icon={Filter} label="Filter" />
              <RibbonButton icon={BarChart3} label="Chart" />
              <RibbonButton icon={Zap} label="Audit" />
            </RibbonGroup>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm">
          {/* User Profile */}
          <div className="p-6 border-b border-slate-200">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold mb-3">
              IG
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Ian Gicheha</h2>
            <p className="text-xs text-slate-500 mt-1">SACCO Manager</p>
          </div>

          {/* Directory */}
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Recent Files</h3>
          </div>

          {/* File List */}
          <ScrollArea className="flex-1">
            <div className="px-4 py-2 space-y-1">
              {[
                { name: 'Trial Balance - January 2026', type: 'excel', icon: Grid3x3 },
                { name: 'M-Pesa Statements', type: 'pdf', icon: FileText },
                { name: 'Member Register', type: 'excel', icon: Grid3x3 },
                { name: 'Loan Listing', type: 'excel', icon: Grid3x3 },
                { name: 'SASRA Form 4', type: 'word', icon: FileText },
                { name: 'Audit Report', type: 'pdf', icon: FileText },
              ].map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => handleFileSelect(file.name, file.type)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                    selectedFile === file.name
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <file.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-medium truncate">{file.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Upload Button */}
          <div className="p-4 border-t border-slate-200">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs gap-2">
              <Upload className="w-4 h-4" /> Upload File
            </Button>
          </div>
        </div>

        {/* Center - Document Viewer (Dynamic) */}
        <div className="flex-1 overflow-hidden">
          {fileType === 'excel' && <ExcelViewer />}
          {fileType === 'word' && <WordViewer />}
          {fileType === 'pdf' && <PdfViewer />}
        </div>

        {/* Right Sidebar - AI Agent */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">AI Assistant</h3>
            </div>
            <Button size="sm" variant="ghost" className="text-slate-600 hover:text-slate-900">
              <Settings className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {agentMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.type === 'agent' && (
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-xs rounded-lg px-4 py-2 text-sm ${
                      msg.type === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Quick Actions */}
          <div className="p-4 border-t border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Quick Actions</p>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs justify-start gap-2">
              <Play className="w-3 h-3" /> Run Audit
            </Button>
            <Button variant="outline" className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 text-xs justify-start gap-2">
              <Download className="w-3 h-3" /> Clean Data
            </Button>
            <Button variant="outline" className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 text-xs justify-start gap-2">
              <FileText className="w-3 h-3" /> SASRA Form 4
            </Button>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Ask AI..."
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="bg-slate-100 border-0 text-sm placeholder:text-slate-400 focus:bg-white"
              />
              <Button onClick={handleSendMessage} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white px-3">
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-slate-200 px-6 py-2 flex items-center justify-between text-xs text-slate-500">
        <div>Ready</div>
        <div className="flex items-center gap-4">
          <span>{selectedFile}</span>
          <span className="text-blue-600 font-medium">{fileType.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
