import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
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
  ZoomOut,
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
  Menu,
  X,
  Maximize2,
  Type,
  Percent,
  DollarSign,
  Sigma,
  Columns,
  Maximize,
  Grid,
  List,
  ArrowUp,
  ArrowDown,
  Shuffle,
  Cloud,
  Bell,
  SettingsIcon,
  Image,
  Link,
  BookOpen,
  Calendar,
  Palette,
  HelpCircle,
  Info,
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState('Trial Balance - January 2026');
  const [fileType, setFileType] = useState<'excel' | 'word' | 'pdf'>('excel');
  const [activeTab, setActiveTab] = useState('home');
  const [selectedCell, setSelectedCell] = useState('A1');
  const [cellValue, setCellValue] = useState('');
  const [excelData, setExcelData] = useState([
    { A: 'Account', B: 'Debit', C: 'Credit', D: '=B2-C2' },
    { A: 'Cash', B: 50000, C: 0, D: '=B2-C2' },
    { A: 'Bank Account', B: 150000, C: 0, D: '=B3-C3' },
    { A: 'Member Loans', B: 500000, C: 0, D: '=B4-C4' },
    { A: 'Savings Account', B: 0, C: 600000, D: '=B5-C5' },
    { A: 'Operating Expenses', B: 25000, C: 0, D: '=B6-C6' },
  ]);
  const [wordContent, setWordContent] = useState('SASRA Form 4 - Financial Statement\n\nThis document contains the financial statements for the SACCO as required by SASRA regulations.\n\nPlease review all sections carefully.');
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: "I'm ready to help. You can edit cells and I'll suggest improvements." },
  ]);
  const [agentInput, setAgentInput] = useState('');
  const [ribbonExpanded, setRibbonExpanded] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [fontSize, setFontSize] = useState('11');
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [wordFormatting, setWordFormatting] = useState({ bold: false, italic: false, underline: false });
  const [clipboard, setClipboard] = useState<{ type: 'cell' | 'text', data: any } | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null);
  const [wordSelection, setWordSelection] = useState<{ start: number; end: number } | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleFileSelect = (fileName: string, type: 'excel' | 'word' | 'pdf') => {
    setSelectedFile(fileName);
    setFileType(type);
    setSelectedCell('A1');
    setCellValue('');
  };

  const handleCellClick = (row: number, col: string) => {
    const cellId = `${col}${row}`;
    setSelectedCell(cellId);
    const data = excelData[row - 1] as any;
    setCellValue(data?.[col] || '');
  };

  // Calculate formula results
  const calculateFormula = (formula: string, data: any[]): string => {
    try {
      const expr = formula.replace(/([A-J])(\d+)/g, (match) => {
        const col = match.charCodeAt(0) - 65;
        const row = parseInt(match.slice(1)) - 1;
        return (data[row]?.[String.fromCharCode(65 + col)] || 0).toString();
      });
      return eval(expr).toString();
    } catch (e) {
      return '#ERROR';
    }
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

  const handleCellDoubleClick = (cellId: string) => {
    setEditingCell(cellId);
    const row = parseInt(cellId.slice(1)) - 1;
    const col = cellId.slice(0, 1);
    const data = excelData[row] as any;
    setEditingValue(data?.[col] || '');
  };

  const handleCellEditSave = () => {
    if (editingCell) {
      const row = parseInt(editingCell.slice(1)) - 1;
      const col = editingCell.slice(0, 1);
      const newData = [...excelData];
      if (newData[row]) {
        (newData[row] as any)[col] = editingValue;
        setExcelData(newData);
      }
    }
    setEditingCell(null);
    setEditingValue('');
  };

  const handleCellEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCellEditSave();
      // Move to next row
      const row = parseInt(editingCell!.slice(1));
      const col = editingCell!.slice(0, 1);
      setSelectedCell(`${col}${row + 1}`);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditingValue('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCellEditSave();
      // Move to next column
      const row = editingCell!.slice(1);
      const col = editingCell!.slice(0, 1);
      const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      const currentIdx = cols.indexOf(col);
      if (currentIdx < cols.length - 1) {
        setSelectedCell(`${cols[currentIdx + 1]}${row}`);
      }
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLTableCellElement>, rowIdx: number, col: string) => {
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const row = rowIdx + 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleCellClick(Math.min(row + 1, 100), col);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (row > 1) handleCellClick(row - 1, col);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const currentIdx = cols.indexOf(col);
      if (currentIdx > 0) handleCellClick(row, cols[currentIdx - 1]);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const currentIdx = cols.indexOf(col);
      if (currentIdx < cols.length - 1) handleCellClick(row, cols[currentIdx + 1]);
    }
  };

  const handleSendMessage = () => {
    if (agentInput.trim()) {
      setMessages([...messages, { id: messages.length + 1, type: 'user', text: agentInput }]);
      setTimeout(() => {
        setMessages((prev) => [...prev, { id: prev.length + 1, type: 'bot', text: 'Processing your request...' }]);
      }, 500);
      setAgentInput('');
    }
  };

  const RibbonButton = ({ icon: Icon, label, onClick }: any) => (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded hover:bg-blue-50 transition-colors group min-w-fit"
      title={label}
    >
      <Icon className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-600" />
      <span className="text-xs text-slate-600 group-hover:text-blue-600 whitespace-nowrap">{label}</span>
    </button>
  );

  const RibbonGroup = ({ title, children }: any) => (
    <div className="flex flex-col items-center gap-1 px-2 py-1.5 border-r border-slate-200 min-w-fit">
      <div className="flex items-center gap-0.5 flex-wrap justify-center">{children}</div>
      <span className="text-xs text-slate-500 whitespace-nowrap">{title}</span>
    </div>
  );

  // Excel Viewer
  const ExcelViewer = () => {
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    return (
      <div className="flex flex-col h-full w-full bg-white overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="border-collapse w-full">
            <tbody>
              {excelData.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="w-12 h-8 border border-slate-300 bg-slate-100 text-xs text-slate-600 text-center font-mono sticky left-0 z-10">
                    {rowIdx + 1}
                  </td>
                  {cols.map((col) => {
                    const isSelected = selectedCell === `${col}${rowIdx + 1}`;
                    const cellData = (row as any)[col];
                    const displayValue = typeof cellData === 'string' && cellData.startsWith('=') 
                      ? calculateFormula(cellData, excelData) 
                      : cellData;
                    return (
                      <td
                        key={`${col}${rowIdx}`}
                        onClick={() => handleCellClick(rowIdx + 1, col)}
                        onDoubleClick={() => handleCellDoubleClick(`${col}${rowIdx + 1}`)}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, col)}
                        className={`w-24 h-8 border border-slate-300 px-2 text-xs cursor-cell font-mono relative ${
                          isSelected
                            ? 'bg-blue-100 border-blue-500 outline-2 outline-blue-600'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                        tabIndex={0}
                      >
                        {editingCell === `${col}${rowIdx + 1}` ? (
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={handleCellEditKeyDown}
                            onBlur={handleCellEditSave}
                            autoFocus
                            className="w-full h-full border-0 outline-0 p-0 text-xs font-mono"
                          />
                        ) : (
                          displayValue
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {Array.from({ length: 100 - excelData.length }).map((_, idx) => (
                <tr key={`empty-${idx}`}>
                  <td className="w-12 h-8 border border-slate-300 bg-slate-100 text-xs text-slate-600 text-center font-mono sticky left-0 z-10">
                    {excelData.length + idx + 1}
                  </td>
                  {cols.map((col) => (
                    <td
                      key={`${col}-empty-${idx}`}
                      onClick={() => handleCellClick(excelData.length + idx + 1, col)}
                      className="w-24 h-8 border border-slate-300 px-2 text-xs cursor-cell font-mono bg-white hover:bg-slate-50"
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Word Viewer
  const WordViewer = () => (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-2 flex-shrink-0 overflow-x-auto">
        <button
          onClick={() => setWordFormatting({ ...wordFormatting, bold: !wordFormatting.bold })}
          className={`p-2 rounded transition-colors ${wordFormatting.bold ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100'}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => setWordFormatting({ ...wordFormatting, italic: !wordFormatting.italic })}
          className={`p-2 rounded transition-colors ${wordFormatting.italic ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100'}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => setWordFormatting({ ...wordFormatting, underline: !wordFormatting.underline })}
          className={`p-2 rounded transition-colors ${wordFormatting.underline ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100'}`}
          title="Underline"
        >
          <Underline className="w-4 h-4" />
        </button>
      </div>
      <textarea
        value={wordContent}
        onChange={(e) => setWordContent(e.target.value)}
        onSelect={(e) => setWordSelection({ start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })}
        className="flex-1 p-6 border-0 outline-0 resize-none text-sm font-serif"
        style={{
          fontWeight: wordFormatting.bold ? 'bold' : 'normal',
          fontStyle: wordFormatting.italic ? 'italic' : 'normal',
          textDecoration: wordFormatting.underline ? 'underline' : 'none',
        }}
      />
    </div>
  );

  // PDF Viewer
  const PdfViewer = () => (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-start flex-shrink-0">
        <span className="text-xs text-slate-600">PDF Preview</span>
      </div>
      <div className="flex-1 overflow-auto w-full bg-slate-100">
        <div className="bg-white w-full h-full p-12 text-center flex items-center justify-center">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">{selectedFile}</p>
          <p className="text-slate-500 text-sm mt-2">PDF Document</p>
        </div>
      </div>
    </div>
  );

  // Copy-Paste Handlers
  const handleCopy = () => {
    if (fileType === 'excel') {
      const data = (excelData[parseInt(selectedCell.slice(1)) - 1] as any)?.[selectedCell.slice(0, 1)];
      setClipboard({ type: 'cell', data });
      toast.success('Cell copied');
    }
  };

  const handlePaste = () => {
    if (fileType === 'excel' && clipboard?.type === 'cell') {
      const row = parseInt(selectedCell.slice(1)) - 1;
      const col = selectedCell.slice(0, 1);
      const newData = [...excelData];
      if (newData[row]) {
        (newData[row] as any)[col] = clipboard.data;
        setExcelData(newData);
        toast.success('Cell pasted');
      }
    }
  };

  const handleCut = () => {
    if (fileType === 'excel') {
      handleCopy();
      const row = parseInt(selectedCell.slice(1)) - 1;
      const col = selectedCell.slice(0, 1);
      const newData = [...excelData];
      if (newData[row]) {
        (newData[row] as any)[col] = '';
        setExcelData(newData);
        setCellValue('');
        toast.success('Cell cut');
      }
    }
  };

  // Word Copy-Paste Handlers
  const handleWordCopy = () => {
    if (fileType === 'word' && wordSelection) {
      const selectedText = wordContent.substring(wordSelection.start, wordSelection.end);
      setClipboard({ type: 'text', data: selectedText });
      toast.success('Text copied');
    } else if (fileType === 'word') {
      setClipboard({ type: 'text', data: wordContent });
      toast.success('All text copied');
    }
  };

  const handleWordPaste = () => {
    if (fileType === 'word' && clipboard?.type === 'text') {
      if (wordSelection) {
        const before = wordContent.substring(0, wordSelection.start);
        const after = wordContent.substring(wordSelection.end);
        setWordContent(before + clipboard.data + after);
      } else {
        setWordContent(wordContent + clipboard.data);
      }
      toast.success('Text pasted');
    }
  };

  const handleWordCut = () => {
    if (fileType === 'word' && wordSelection) {
      handleWordCopy();
      const before = wordContent.substring(0, wordSelection.start);
      const after = wordContent.substring(wordSelection.end);
      setWordContent(before + after);
      toast.success('Text cut');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        if (fileType === 'excel') handleCopy();
        else if (fileType === 'word') handleWordCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        if (fileType === 'excel') handlePaste();
        else if (fileType === 'word') handleWordPaste();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        if (fileType === 'excel') handleCut();
        else if (fileType === 'word') handleWordCut();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileType, selectedCell, cellValue, excelData, wordContent, wordSelection, clipboard]);

  const handleToolClick = (toolName: string) => {
    toast.success(`${toolName} activated`);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900">
      {/* Premium Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">SACCO IDE</h1>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Collapsible */}
        <div className={`bg-white border-r border-slate-200 flex flex-col shadow-sm transition-all duration-300 ${sidebarExpanded ? 'w-72' : 'w-16'}`}>

          {/* Directory - Hidden when collapsed */}
          {sidebarExpanded && (
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Recent Files</h3>
            </div>
          )}

          {/* File List */}
          <ScrollArea className="flex-1">
            <div className={sidebarExpanded ? 'px-4 py-2 space-y-1' : 'px-2 py-2 space-y-2'}>
              {[
                { name: 'Trial Balance - January 2026', type: 'excel', icon: Grid3x3 },
                { name: 'M-Pesa Statements', type: 'pdf', icon: FileText },
                { name: 'Member Register', type: 'excel', icon: Grid3x3 },
                { name: 'Loan Listing', type: 'excel', icon: Grid3x3 },
                { name: 'SASRA Form 4', type: 'word', icon: FileText },
                { name: 'Audit Report', type: 'pdf', icon: FileText },
              ].map((file: any, idx) => (
                <button
                  key={idx}
                  onClick={() => handleFileSelect(file.name, file.type as 'excel' | 'word' | 'pdf')}
                  className={`flex items-center gap-3 rounded-lg transition-colors ${
                    selectedFile === file.name
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-50'
                  } ${sidebarExpanded ? 'w-full px-3 py-2 text-left' : 'w-10 h-10 mx-auto justify-center'}`}
                  title={sidebarExpanded ? '' : file.name}
                >
                  <file.icon className="w-4 h-4 flex-shrink-0" />
                  {sidebarExpanded && <span className="text-xs font-medium truncate">{file.name}</span>}
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Upload Button */}
          {sidebarExpanded && (
            <div className="p-4 border-t border-slate-200">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs gap-2">
                <Upload className="w-4 h-4" /> Upload File
              </Button>
            </div>
          )}

          {/* Logo and Toggle at Bottom */}
          <div className="p-3 border-t border-slate-200 flex items-center justify-between">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0 ${!sidebarExpanded && 'mx-auto'}`}>
              IG
            </div>
            {sidebarExpanded && (
              <button
                onClick={() => setSidebarExpanded(!sidebarExpanded)}
                className="text-slate-600 hover:text-slate-900 transition-colors"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Expand button when collapsed */}
          {!sidebarExpanded && (
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="p-2 text-slate-600 hover:text-slate-900 transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Center - Document Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs - Centered at top of document area */}
          <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-center gap-1 shadow-sm">
            {['home', 'insert', 'layout', 'formulas', 'data', 'view', 'settings'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab === 'layout' ? 'Page Layout' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Ribbon Content */}
          <div className={`bg-white border-b border-slate-200 overflow-x-auto overflow-y-hidden transition-all duration-300 ${ribbonExpanded ? 'block h-auto' : 'hidden h-0'}`}>
            {/* HOME TAB */}
            {ribbonExpanded && activeTab === 'home' && (
              <div className="flex gap-0.5 p-2">
                <RibbonGroup title="Clipboard">
                  <RibbonButton icon={Clipboard} label="Paste" onClick={handlePaste} />
                  <RibbonButton icon={Copy} label="Copy" onClick={handleCopy} />
                  <RibbonButton icon={Trash2} label="Cut" onClick={handleCut} />
                </RibbonGroup>

                <RibbonGroup title="Font">
                  <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="px-2 py-1 text-xs border border-slate-200 rounded">
                    <option>Calibri</option>
                    <option>Arial</option>
                    <option>Times New Roman</option>
                  </select>
                  <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="px-2 py-1 text-xs border border-slate-200 rounded">
                    <option>9</option>
                    <option>11</option>
                    <option>12</option>
                    <option>14</option>
                  </select>
                  <RibbonButton icon={Bold} label="Bold" onClick={() => handleToolClick('Bold')} />
                  <RibbonButton icon={Italic} label="Italic" onClick={() => handleToolClick('Italic')} />
                  <RibbonButton icon={Underline} label="Underline" onClick={() => handleToolClick('Underline')} />
                </RibbonGroup>

                <RibbonGroup title="Alignment">
                  <RibbonButton icon={AlignLeft} label="Left" onClick={() => handleToolClick('Align Left')} />
                  <RibbonButton icon={AlignCenter} label="Center" onClick={() => handleToolClick('Align Center')} />
                  <RibbonButton icon={AlignRight} label="Right" onClick={() => handleToolClick('Align Right')} />
                  <RibbonButton icon={AlignJustify} label="Justify" onClick={() => handleToolClick('Justify')} />
                </RibbonGroup>

                <RibbonGroup title="Number">
                  <RibbonButton icon={Percent} label="Percent" onClick={() => handleToolClick('Percent')} />
                  <RibbonButton icon={DollarSign} label="Currency" onClick={() => handleToolClick('Currency')} />
                </RibbonGroup>

                <RibbonGroup title="Cells">
                  <RibbonButton icon={Plus} label="Insert" onClick={() => handleToolClick('Insert Cells')} />
                  <RibbonButton icon={Trash2} label="Delete" onClick={() => handleToolClick('Delete Cells')} />
                  <RibbonButton icon={Settings} label="Format" onClick={() => handleToolClick('Format Cells')} />
                </RibbonGroup>

                <RibbonGroup title="Paragraph">
                  <RibbonButton icon={ChevronUp} label="Increase" onClick={() => handleToolClick('Increase Indent')} />
                  <RibbonButton icon={ChevronDown} label="Decrease" onClick={() => handleToolClick('Decrease Indent')} />
                  <RibbonButton icon={List} label="Spacing" onClick={() => handleToolClick('Paragraph Spacing')} />
                </RibbonGroup>

                <RibbonGroup title="Styles">
                  <RibbonButton icon={Type} label="Normal" onClick={() => handleToolClick('Normal Style')} />
                  <RibbonButton icon={BarChart3} label="Heading 1" onClick={() => handleToolClick('Heading 1')} />
                  <RibbonButton icon={BarChart3} label="Heading 2" onClick={() => handleToolClick('Heading 2')} />
                </RibbonGroup>

                <RibbonGroup title="Editing">
                  <RibbonButton icon={Filter} label="Find" onClick={() => handleToolClick('Find')} />
                  <RibbonButton icon={Zap} label="Replace" onClick={() => handleToolClick('Replace')} />
                  <RibbonButton icon={Eye} label="Select" onClick={() => handleToolClick('Select All')} />
                </RibbonGroup>
              </div>
            )}

            {/* INSERT TAB */}
            {ribbonExpanded && activeTab === 'insert' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Tables">
                  <RibbonButton icon={Grid} label="Table" onClick={() => handleToolClick('Insert Table')} />
                </RibbonGroup>
                <RibbonGroup title="Illustrations">
                  <RibbonButton icon={Image} label="Picture" onClick={() => handleToolClick('Insert Picture')} />
                  <RibbonButton icon={BarChart3} label="Chart" onClick={() => handleToolClick('Insert Chart')} />
                  <RibbonButton icon={Plus} label="Shapes" onClick={() => handleToolClick('Insert Shapes')} />
                </RibbonGroup>
                <RibbonGroup title="Text">
                  <RibbonButton icon={Type} label="Text Box" onClick={() => handleToolClick('Insert Text Box')} />
                  <RibbonButton icon={FileText} label="Header" onClick={() => handleToolClick('Insert Header')} />
                  <RibbonButton icon={FileText} label="Footer" onClick={() => handleToolClick('Insert Footer')} />
                </RibbonGroup>
                <RibbonGroup title="Links">
                  <RibbonButton icon={Link} label="Hyperlink" onClick={() => handleToolClick('Insert Hyperlink')} />
                  <RibbonButton icon={BookOpen} label="Bookmark" onClick={() => handleToolClick('Insert Bookmark')} />
                </RibbonGroup>
              </div>
            )}

            {/* PAGE LAYOUT TAB */}
            {ribbonExpanded && activeTab === 'layout' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Page Setup">
                  <RibbonButton icon={Columns} label="Margins" onClick={() => handleToolClick('Set Margins')} />
                  <RibbonButton icon={Maximize2} label="Orientation" onClick={() => handleToolClick('Change Orientation')} />
                  <RibbonButton icon={Grid} label="Size" onClick={() => handleToolClick('Set Page Size')} />
                </RibbonGroup>
                <RibbonGroup title="Sheet Options">
                  <RibbonButton icon={Eye} label="Freeze Panes" onClick={() => handleToolClick('Freeze Panes')} />
                  <RibbonButton icon={Grid} label="Gridlines" onClick={() => handleToolClick('Toggle Gridlines')} />
                </RibbonGroup>
                <RibbonGroup title="Themes">
                  <RibbonButton icon={Palette} label="Colors" onClick={() => handleToolClick('Change Colors')} />
                  <RibbonButton icon={Type} label="Fonts" onClick={() => handleToolClick('Change Fonts')} />
                </RibbonGroup>
              </div>
            )}

            {/* FORMULAS TAB */}
            {ribbonExpanded && activeTab === 'formulas' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Financial">
                  <RibbonButton icon={DollarSign} label="SUM" onClick={() => handleToolClick('SUM')} />
                  <RibbonButton icon={DollarSign} label="AVERAGE" onClick={() => handleToolClick('AVERAGE')} />
                  <RibbonButton icon={DollarSign} label="PMT" onClick={() => handleToolClick('PMT')} />
                  <RibbonButton icon={DollarSign} label="NPV" onClick={() => handleToolClick('NPV')} />
                </RibbonGroup>
                <RibbonGroup title="Logical">
                  <RibbonButton icon={Filter} label="IF" onClick={() => handleToolClick('IF')} />
                  <RibbonButton icon={Filter} label="AND" onClick={() => handleToolClick('AND')} />
                  <RibbonButton icon={Filter} label="OR" onClick={() => handleToolClick('OR')} />
                </RibbonGroup>
                <RibbonGroup title="Text">
                  <RibbonButton icon={Type} label="CONCAT" onClick={() => handleToolClick('CONCAT')} />
                  <RibbonButton icon={Type} label="LEN" onClick={() => handleToolClick('LEN')} />
                  <RibbonButton icon={Type} label="UPPER" onClick={() => handleToolClick('UPPER')} />
                </RibbonGroup>
                <RibbonGroup title="Date & Time">
                  <RibbonButton icon={Calendar} label="TODAY" onClick={() => handleToolClick('TODAY')} />
                  <RibbonButton icon={Calendar} label="DATE" onClick={() => handleToolClick('DATE')} />
                </RibbonGroup>
              </div>
            )}
          </div>

            {/* DATA TAB */}
            {ribbonExpanded && activeTab === 'data' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Sort & Filter">
                  <RibbonButton icon={ArrowUp} label="Sort A-Z" onClick={() => handleToolClick('Sort Ascending')} />
                  <RibbonButton icon={ArrowDown} label="Sort Z-A" onClick={() => handleToolClick('Sort Descending')} />
                  <RibbonButton icon={Filter} label="AutoFilter" onClick={() => handleToolClick('Apply AutoFilter')} />
                </RibbonGroup>
                <RibbonGroup title="Data Tools">
                  <RibbonButton icon={BarChart3} label="Subtotals" onClick={() => handleToolClick('Insert Subtotals')} />
                  <RibbonButton icon={Grid} label="Validation" onClick={() => handleToolClick('Data Validation')} />
                  <RibbonButton icon={Zap} label="Text to Columns" onClick={() => handleToolClick('Text to Columns')} />
                </RibbonGroup>
              </div>
            )}

            {/* VIEW TAB */}
            {ribbonExpanded && activeTab === 'view' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Workbook Views">
                  <RibbonButton icon={Eye} label="Normal" onClick={() => handleToolClick('Normal View')} />
                  <RibbonButton icon={Eye} label="Page Break" onClick={() => handleToolClick('Page Break View')} />
                </RibbonGroup>
                <RibbonGroup title="Show/Hide">
                  <RibbonButton icon={Eye} label="Gridlines" onClick={() => handleToolClick('Toggle Gridlines')} />
                  <RibbonButton icon={Eye} label="Headers" onClick={() => handleToolClick('Toggle Headers')} />
                  <RibbonButton icon={Eye} label="Formulas" onClick={() => handleToolClick('Show Formulas')} />
                </RibbonGroup>
                <RibbonGroup title="Zoom">
                  <RibbonButton icon={ZoomIn} label="Zoom In" onClick={() => handleToolClick('Zoom In')} />
                  <RibbonButton icon={ZoomOut} label="Zoom Out" onClick={() => handleToolClick('Zoom Out')} />
                </RibbonGroup>
              </div>
            )}

            {/* SETTINGS TAB */}
            {ribbonExpanded && activeTab === 'settings' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Options">
                  <RibbonButton icon={Settings} label="Preferences" onClick={() => handleToolClick('Open Preferences')} />
                  <RibbonButton icon={Settings} label="Language" onClick={() => handleToolClick('Change Language')} />
                </RibbonGroup>
                <RibbonGroup title="Help">
                  <RibbonButton icon={HelpCircle} label="Help" onClick={() => handleToolClick('Open Help')} />
                  <RibbonButton icon={Info} label="About" onClick={() => handleToolClick('About SACCO IDE')} />
                </RibbonGroup>
              </div>
            )}

          {/* Collapse/Expand Toggle Button - Centered */}
          <div className="flex justify-center py-1 bg-white border-b border-slate-200">
            <button
              onClick={() => setRibbonExpanded(!ribbonExpanded)}
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900"
              title={ribbonExpanded ? 'Collapse Ribbon' : 'Expand Ribbon'}
            >
              {ribbonExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Document Viewer */}
          <div className="flex-1 overflow-hidden">
            {fileType === 'excel' && <ExcelViewer />}
            {fileType === 'word' && <WordViewer />}
            {fileType === 'pdf' && <PdfViewer />}
          </div>
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
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-lg text-xs ${msg.type === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Quick Actions */}
          <div className="p-4 border-t border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase">Quick Actions</p>
            <Button variant="outline" className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 text-xs justify-start gap-2">
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
          <div className="p-4 border-t border-slate-200 flex gap-2">
            <Input
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask AI..."
              className="text-xs"
            />
            <Button size="sm" onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-slate-200 px-6 py-2 text-xs text-slate-600 flex items-center justify-between">
        <span>Ready</span>
        <span>{selectedCell}</span>
                {/* Bottom Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 text-center text-xs text-slate-600">
          SACCO IDE
        </div>
      </div>
    </div>
  );
}
