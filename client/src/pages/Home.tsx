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
  Search,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Undo2,
  Redo2,
  PanelLeftClose,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { parseFormula } from '@/lib/formulaParser';
import { ExcelSheet } from '@/components/ExcelSheet';

export default function Home() {
  type SheetPreviewRow = Record<string, string>;
  type UploadedSheet = {
    sheetName: string;
    headers: string[];
    previewRows: SheetPreviewRow[];
    totalRows: number;
    previewTruncated: boolean;
    loadedRows: number;
  };
  type UploadedFileItem = {
    name: string;
    type: 'excel' | 'word' | 'pdf';
    defaultSheetName: string;
    activeSheetName: string;
    sheets: UploadedSheet[];
  };
  type PendingOperation = {
    id: string;
    address: string;
    sheet: string;
    rationale: string;
    tool: string;
  };
  const emptySheetRows: SheetPreviewRow[] = [];

  const [selectedFile, setSelectedFile] = useState('No file selected');
  const [fileType, setFileType] = useState<'excel' | 'word' | 'pdf'>('excel');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [currentHeaders, setCurrentHeaders] = useState<string[]>([]);
  const [currentSheetName, setCurrentSheetName] = useState('');
  const [currentFileMeta, setCurrentFileMeta] = useState<UploadedFileItem | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedCell, setSelectedCell] = useState('A1');
  const [cellValue, setCellValue] = useState('');
  const [excelData, setExcelData] = useState<SheetPreviewRow[]>(emptySheetRows);
  const [wordContent, setWordContent] = useState('SASRA Form 4 - Financial Statement\n\nThis document contains the financial statements for the SACCO as required by SASRA regulations.\n\nPlease review all sections carefully.');
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: "I'm ready to help. You can edit cells and I'll suggest improvements." },
  ]);
  const [agentInput, setAgentInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
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
  const [history, setHistory] = useState<any[]>([emptySheetRows]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [aiAssistantVisible, setAiAssistantVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isLoadingMoreRows, setIsLoadingMoreRows] = useState(false);

  const refreshPendingOperations = async (currentSessionId: string) => {
    const response = await fetch(
      `http://localhost:3001/pending?sessionId=${encodeURIComponent(currentSessionId)}`
    );
    if (!response.ok) {
      throw new Error(`Failed to load pending operations (${response.status})`);
    }
    const data = await response.json();
    const pending = Array.isArray(data?.pending) ? data.pending : [];
    setPendingOperations(pending);
    return pending;
  };

  const runQuickPrompt = async (prompt: string) => {
    if (!sessionId) {
      toast.error('Upload a spreadsheet first to start a review session.');
      return;
    }

    setMessages((prev) => [...prev, { id: Date.now(), type: 'user', text: prompt }]);
    setIsAiThinking(true);
    try {
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: prompt }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Chat failed (${response.status}) ${body}`.trim());
      }
      const result = await response.json();
      const aiMessage = typeof result?.message === 'string'
        ? result.message
        : 'Analysis complete. Review pending changes.';
      setMessages((prev) => [...prev, { id: Date.now() + 1, type: 'bot', text: aiMessage }]);
      const pending = await refreshPendingOperations(sessionId);
      if (pending.length > 0) {
        toast.info(`${pending.length} pending change(s) ready for review.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown AI error';
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, type: 'bot', text: `AI error: ${message}` },
      ]);
      toast.error(message);
    } finally {
      setIsAiThinking(false);
    }
  };

  const reviewOperation = async (
    operationId: string,
    decision: 'accept' | 'reject'
  ) => {
    if (!sessionId) {
      toast.error('No active session.');
      return;
    }
    const response = await fetch(`http://localhost:3001/${decision}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, operationId }),
    });
    const result = await response.json();
    if (!response.ok || result?.success === false) {
      throw new Error(result?.message || `${decision} failed`);
    }
    await refreshPendingOperations(sessionId);
    toast.success(result?.message || `Operation ${decision}ed.`);
  };

  const reviewNextOperation = async (decision: 'accept' | 'reject') => {
    if (pendingOperations.length === 0) {
      toast.info('No pending operations to review.');
      return;
    }
    await reviewOperation(pendingOperations[0].id, decision);
  };

  const exportCurrentSession = async () => {
    if (!sessionId) {
      toast.error('No active session.');
      return;
    }
    const response = await fetch(
      `http://localhost:3001/export?sessionId=${encodeURIComponent(sessionId)}`
    );
    if (!response.ok) {
      throw new Error(`Export failed (${response.status})`);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meridian_export_${sessionId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success('Export downloaded.');
  };

  const handleFileSelect = (fileName: string, type: 'excel' | 'word' | 'pdf') => {
    setSelectedFile(fileName);
    setFileType(type);
    setSelectedCell('A1');
    setCellValue('');

    const selected = uploadedFiles.find((file) => file.name === fileName);
    if (selected) {
      setCurrentFileMeta(selected);
      const activeSheet =
        selected.sheets.find((sheet) => sheet.sheetName === selected.activeSheetName) ||
        selected.sheets.find((sheet) => sheet.sheetName === selected.defaultSheetName) ||
        selected.sheets[0];
      setCurrentSheetName(activeSheet?.sheetName || '');
      setCurrentHeaders(activeSheet?.headers || []);
      if (activeSheet && activeSheet.previewRows.length > 0) {
        setExcelData(activeSheet.previewRows);
        setHistory([activeSheet.previewRows]);
        setHistoryIndex(0);
      } else {
        setExcelData(emptySheetRows);
        setHistory([emptySheetRows]);
        setHistoryIndex(0);
      }
    }
  };

  const inferFileType = (fileName: string): 'excel' | 'word' | 'pdf' => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.doc') || lower.endsWith('.docx') || lower.endsWith('.txt')) return 'word';
    return 'excel';
  };

  const handleUserFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const processUpload = async () => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const invalidFiles = files.filter((file) => {
        const lower = file.name.toLowerCase();
        return !(lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls'));
      });
      if (invalidFiles.length > 0) {
        toast.error('Only CSV, XLSX, and XLS files are supported for backend parsing.');
        e.target.value = '';
        return;
      }

      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));

      try {
        setIsUploadingFiles(true);
        toast.info('Uploading and parsing files...');

        const response = await fetch('http://localhost:3001/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed (${response.status})`);
        }

        const result = await response.json();
        const serverParsedFiles = Array.isArray(result?.parsedFiles) ? result.parsedFiles : [];
        const parsedByName = new Map<string, UploadedFileItem>();
        serverParsedFiles.forEach((file: any) => {
          const fileName = String(file.fileName || 'uploaded_file.csv');
          const sheets: UploadedSheet[] = Array.isArray(file.sheets)
            ? file.sheets.map((sheet: any) => ({
                sheetName: String(sheet.sheetName || 'Sheet1'),
                headers: Array.isArray(sheet.headers) ? sheet.headers.map((h: unknown) => String(h)) : [],
                previewRows: Array.isArray(sheet.previewRows) ? sheet.previewRows : [],
                totalRows: Number(sheet.totalRows || 0),
                previewTruncated: Boolean(sheet.previewTruncated),
                loadedRows: Array.isArray(sheet.previewRows) ? sheet.previewRows.length : 0,
              }))
            : [];
          const defaultSheetName = String(file.defaultSheetName || sheets[0]?.sheetName || 'Sheet1');
          parsedByName.set(fileName, {
            name: fileName,
            type: inferFileType(fileName),
            defaultSheetName,
            activeSheetName: defaultSheetName,
            sheets,
          });
        });

        // Always include files the user selected so sidebar stays in sync
        // even when backend cannot parse preview rows.
        const mappedFiles: UploadedFileItem[] = files.map((selectedFile) => {
          const parsed = parsedByName.get(selectedFile.name);
          return parsed || {
            name: selectedFile.name,
            type: inferFileType(selectedFile.name),
            defaultSheetName: 'Sheet1',
            activeSheetName: 'Sheet1',
            sheets: [],
          };
        });

        setUploadedFiles((prev) => {
          const byName = new Map<string, UploadedFileItem>();
          prev.forEach((file) => byName.set(file.name, file));
          mappedFiles.forEach((file) => byName.set(file.name, file));
          return Array.from(byName.values()).reverse();
        });

        const firstFile = mappedFiles[0];
        if (firstFile) {
          setCurrentFileMeta(firstFile);
          setSelectedFile(firstFile.name);
          setFileType(firstFile.type);
          setSelectedCell('A1');
          setCellValue('');
          const activeSheet =
            firstFile.sheets.find((sheet) => sheet.sheetName === firstFile.activeSheetName) ||
            firstFile.sheets.find((sheet) => sheet.sheetName === firstFile.defaultSheetName) ||
            firstFile.sheets[0];
          setCurrentSheetName(activeSheet?.sheetName || '');
          if (activeSheet && activeSheet.previewRows.length > 0) {
            setExcelData(activeSheet.previewRows);
            setHistory([activeSheet.previewRows]);
            setHistoryIndex(0);
            setCurrentHeaders(activeSheet.headers);
          } else {
            setExcelData(emptySheetRows);
            setHistory([emptySheetRows]);
            setHistoryIndex(0);
            setCurrentHeaders([]);
          }
          if (activeSheet?.previewTruncated) {
            toast.info(`Showing first ${activeSheet.previewRows.length.toLocaleString()} of ${activeSheet.totalRows.toLocaleString()} rows for faster review.`);
          }
        }

        // Initialize Meridian review session from first selected file.
        const firstSelected = files[0];
        if (firstSelected) {
          const sessionForm = new FormData();
          sessionForm.append('file', firstSelected);
          const sessionRes = await fetch('http://localhost:3001/upload', {
            method: 'POST',
            body: sessionForm,
          });
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            const newSessionId = typeof sessionData?.sessionId === 'string'
              ? sessionData.sessionId
              : null;
            setSessionId(newSessionId);
            setPendingOperations([]);
            if (newSessionId) {
              toast.success(`Review session ready (${newSessionId}).`);
            }
          } else {
            toast.error('Files uploaded, but review session could not be initialized.');
          }
        }
        toast.success(`Uploaded ${files.length} file(s) successfully.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Upload failed.');
      } finally {
        setIsUploadingFiles(false);
        // Allow selecting the same file again later.
        e.target.value = '';
      }
    };

    void processUpload();
  };

  const handleLoadMoreRows = async () => {
    if (!currentFileMeta || !currentSheetName) {
      return;
    }
    const activeSheet = currentFileMeta.sheets.find((sheet) => sheet.sheetName === currentSheetName);
    if (!activeSheet || activeSheet.loadedRows >= activeSheet.totalRows) {
      return;
    }

    try {
      setIsLoadingMoreRows(true);
      const response = await fetch(
        `http://localhost:3001/api/upload/preview?fileName=${encodeURIComponent(currentFileMeta.name)}&sheetName=${encodeURIComponent(currentSheetName)}&offset=${activeSheet.loadedRows}&limit=500`
      );
      if (!response.ok) {
        throw new Error(`Failed to load more rows (${response.status})`);
      }
      const result = await response.json();
      const newRows = Array.isArray(result.rows) ? result.rows : [];
      if (newRows.length === 0) return;

      setExcelData((prev) => [...prev, ...newRows]);

      setUploadedFiles((prev) =>
        prev.map((file) =>
          file.name === currentFileMeta.name
            ? {
                ...file,
                sheets: file.sheets.map((sheet) =>
                  sheet.sheetName === currentSheetName
                    ? {
                        ...sheet,
                        previewRows: [...sheet.previewRows, ...newRows],
                        loadedRows: Number(result.nextOffset || sheet.loadedRows + newRows.length),
                        totalRows: Number(result.totalRows || sheet.totalRows),
                      }
                    : sheet
                ),
              }
            : file
        )
      );

      setCurrentFileMeta((prev) =>
        prev
          ? {
              ...prev,
              sheets: prev.sheets.map((sheet) =>
                sheet.sheetName === currentSheetName
                  ? {
                      ...sheet,
                      previewRows: [...sheet.previewRows, ...newRows],
                      loadedRows: Number(result.nextOffset || sheet.loadedRows + newRows.length),
                      totalRows: Number(result.totalRows || sheet.totalRows),
                    }
                  : sheet
              ),
            }
          : prev
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load more rows');
    } finally {
      setIsLoadingMoreRows(false);
    }
  };

  const handleCellClick = (row: number, col: string) => {
    const cellId = `${col}${row}`;
    setSelectedCell(cellId);
    const data = excelData[row - 1] as any;
    setCellValue(data?.[col] || '');
  };

  // Calculate formula results using the new parser
  const calculateFormula = (formula: string, data: any[]): string => {
    const result = parseFormula(formula, data);
    return result.toString();
  };

  const handleCellChange = (value: string) => {
    setCellValue(value);
    const row = parseInt(selectedCell.slice(1)) - 1;
    const col = selectedCell.slice(0, 1);
    const newData = [...excelData];
    if (newData[row]) {
      (newData[row] as any)[col] = value;
      setExcelData(newData);
      addToHistory(newData);
    }
  };

  const handleExcelDataChange = (newData: any[]) => {
    setExcelData(newData);
    addToHistory(newData);
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
        addToHistory(newData);
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

  const handleSendMessage = async () => {
    const userText = agentInput.trim();
    if (!userText || isAiThinking) return;

    setAgentInput('');
    await runQuickPrompt(userText);
  };

  const addToHistory = (newData: any) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setExcelData(history[newIndex]);
      toast.success('Undo applied');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setExcelData(history[newIndex]);
      toast.success('Redo applied');
    }
  };

  const handleReload = () => {
    setExcelData(emptySheetRows);
    setHistory([emptySheetRows]);
    setHistoryIndex(0);
    setSelectedCell('A1');
    setCellValue('');
    setCurrentHeaders([]);
    setCurrentSheetName('');
    toast.success('Sheet cleared');
  };

  const handleSheetChange = (sheetName: string) => {
    if (!currentFileMeta) return;
    const target = currentFileMeta.sheets.find((sheet) => sheet.sheetName === sheetName);
    if (!target) return;

    setCurrentSheetName(sheetName);
    setCurrentHeaders(target.headers);
    setExcelData(target.previewRows);
    setHistory([target.previewRows]);
    setHistoryIndex(0);
    setSelectedCell('A1');
    setCellValue('');

    setUploadedFiles((prev) =>
      prev.map((file) =>
        file.name === currentFileMeta.name
          ? { ...file, activeSheetName: sheetName }
          : file
      )
    );

    setCurrentFileMeta((prev) => (prev ? { ...prev, activeSheetName: sheetName } : prev));
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

  // Excel Viewer - using new ExcelSheet component
  const ExcelViewer = () => (
    <div className="h-full flex flex-col">
      {currentFileMeta && currentFileMeta.sheets.length > 1 && (
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <span className="text-xs text-slate-600">Sheet:</span>
          <select
            value={currentSheetName}
            onChange={(e) => handleSheetChange(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
          >
            {currentFileMeta.sheets.map((sheet) => (
              <option key={sheet.sheetName} value={sheet.sheetName}>
                {sheet.sheetName}
              </option>
            ))}
          </select>
        </div>
      )}
      <ExcelSheet
        data={excelData}
        onDataChange={setExcelData}
        selectedCell={selectedCell}
        onCellSelect={setSelectedCell}
        editingCell={editingCell}
        onEditStart={setEditingCell}
        onEditEnd={() => setEditingCell(null)}
        columnHeaders={currentHeaders}
        onLoadMoreRows={handleLoadMoreRows}
        canLoadMoreRows={Boolean(currentFileMeta && currentSheetName && (() => {
          const activeSheet = currentFileMeta.sheets.find((sheet) => sheet.sheetName === currentSheetName);
          return activeSheet ? activeSheet.loadedRows < activeSheet.totalRows : false;
        })())}
        isLoadingMoreRows={isLoadingMoreRows}
      />
    </div>
  );

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
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileType, selectedCell, cellValue, excelData, wordContent, wordSelection, clipboard, historyIndex, history]);

  const handleToolClick = (toolName: string) => {
    toast.success(`${toolName} activated`);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900">
      {/* Premium Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={handleUndo} className="p-1.5 hover:bg-slate-100 rounded transition-colors" title="Undo">
            <Undo2 className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={handleRedo} className="p-1.5 hover:bg-slate-100 rounded transition-colors" title="Redo">
            <Redo2 className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={handleReload} className="p-1.5 hover:bg-slate-100 rounded transition-colors" title="Reload">
            <RotateCw className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <h1 className="text-lg font-bold text-slate-900 flex-1 text-center">SACCO IDE</h1>
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded">
          <Search className="w-4 h-4 text-slate-600" />
          <input type="text" placeholder="Search..." className="bg-transparent text-xs outline-none w-32" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Collapsible */}
        <div className={`bg-white border-r border-slate-200 flex flex-col shadow-sm transition-all duration-300 ${sidebarExpanded ? 'w-72' : 'w-16'}`}>

          {/* Directory - Hidden when collapsed */}
          {sidebarExpanded && (
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Recent Files</h3>
              <button
                onClick={() => setSidebarExpanded(false)}
                className="text-slate-600 hover:text-slate-900 transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          )}
          {!sidebarExpanded && (
            <div className="px-2 py-3 border-b border-slate-200 flex justify-center">
              <button
                onClick={() => setSidebarExpanded(true)}
                className="text-slate-600 hover:text-slate-900 transition-colors"
                title="Expand sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* File List */}
          <ScrollArea className="flex-1">
            <div className={sidebarExpanded ? 'px-4 py-2 space-y-1' : 'px-2 py-2 space-y-2'}>
              {uploadedFiles.length === 0 && sidebarExpanded && (
                <p className="text-xs text-slate-500 px-3 py-2">
                  No files yet. Click Upload File to add your own.
                </p>
              )}
              {uploadedFiles.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => handleFileSelect(file.name, file.type)}
                  className={`flex items-center gap-3 rounded-lg transition-colors ${
                    selectedFile === file.name
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-50'
                  } ${sidebarExpanded ? 'w-full px-3 py-2 text-left' : 'w-10 h-10 mx-auto justify-center'}`}
                  title={sidebarExpanded ? '' : file.name}
                >
                  {file.type === 'excel' ? (
                    <Grid3x3 className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 flex-shrink-0" />
                  )}
                  {sidebarExpanded && <span className="text-xs font-medium truncate">{file.name}</span>}
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Upload Button */}
          {sidebarExpanded && (
            <div className="p-4 border-t border-slate-200">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleUserFileUpload}
                className="hidden"
                accept=".csv,.xlsx,.xls,.pdf,.doc,.docx,.txt"
              />
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingFiles}
              >
                <Upload className="w-4 h-4" /> {isUploadingFiles ? 'Uploading...' : 'Upload File'}
              </Button>
            </div>
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
                  <RibbonButton icon={Sigma} label="SUM" onClick={() => handleToolClick('SUM')} />
                  <RibbonButton icon={TrendingUp} label="AVERAGE" onClick={() => handleToolClick('AVERAGE')} />
                  <RibbonButton icon={DollarSign} label="PMT" onClick={() => handleToolClick('PMT')} />
                  <RibbonButton icon={BarChart3} label="NPV" onClick={() => handleToolClick('NPV')} />
                </RibbonGroup>
                <RibbonGroup title="Logical">
                  <RibbonButton icon={Zap} label="IF" onClick={() => handleToolClick('IF')} />
                  <RibbonButton icon={Zap} label="AND" onClick={() => handleToolClick('AND')} />
                  <RibbonButton icon={Zap} label="OR" onClick={() => handleToolClick('OR')} />
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

        {/* Floating AI Assistant Button */}
        {!aiAssistantVisible && (
          <button
            onClick={() => setAiAssistantVisible(true)}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 z-50"
            title="Open AI Assistant"
          >
            <Sparkles className="w-6 h-6" />
          </button>
        )}

        {/* Right Sidebar - AI Agent */}
        {aiAssistantVisible && (
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">AI Assistant</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                Pending: {pendingOperations.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="text-slate-600 hover:text-slate-900">
                <Settings className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAiAssistantVisible(false)} className="text-slate-600 hover:text-slate-900">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-lg text-xs ${msg.type === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
                    {msg.type !== 'user' && (
                      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-blue-600">
                        <Sparkles className="w-3 h-3" />
                        <span>Auto Agent</span>
                      </div>
                    )}
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
            <Button
              variant="outline"
              className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 text-xs justify-start gap-2"
              onClick={() => void runQuickPrompt('Run a forensic audit and flag suspicious records.')}
            >
              <Download className="w-3 h-3" /> Clean Data
            </Button>
            <Button
              variant="outline"
              className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 text-xs justify-start gap-2"
              onClick={() => void runQuickPrompt('Apply SASRA Form 4 provisioning for current sheet.')}
            >
              <FileText className="w-3 h-3" /> SASRA Form 4
            </Button>
            <Button
              variant="outline"
              className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 text-xs justify-start gap-2"
              onClick={() => void reviewNextOperation('accept')}
              disabled={pendingOperations.length === 0}
            >
              <Sparkles className="w-3 h-3" /> Accept Next Change
            </Button>
            <Button
              variant="outline"
              className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 text-xs justify-start gap-2"
              onClick={() => void reviewNextOperation('reject')}
              disabled={pendingOperations.length === 0}
            >
              <X className="w-3 h-3" /> Reject Next Change
            </Button>
            <Button
              variant="outline"
              className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 text-xs justify-start gap-2"
              onClick={() => void exportCurrentSession()}
              disabled={!sessionId}
            >
              <Download className="w-3 h-3" /> Export Session
            </Button>
          </div>

          {/* Pending Operations List */}
          <div className="px-4 pb-4 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-600 uppercase mt-3 mb-2">
              Pending Changes
            </p>
            <div className="max-h-44 overflow-auto space-y-2">
              {pendingOperations.length === 0 ? (
                <p className="text-[11px] text-slate-500">No pending changes.</p>
              ) : (
                pendingOperations.slice(0, 8).map((op) => (
                  <div
                    key={op.id}
                    className="rounded border border-slate-200 p-2 bg-slate-50"
                  >
                    <div className="text-[11px] font-medium text-slate-800">
                      {op.sheet}!{op.address} · {op.tool}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1 line-clamp-2">
                      {op.rationale}
                    </div>
                    <div className="mt-2 flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => void reviewOperation(op.id, 'accept')}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => void reviewOperation(op.id, 'reject')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200">
            <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
              <Sparkles className="h-3 w-3" />
              <span>Auto Agent</span>
            </div>
            <div className="flex gap-2">
            <Input
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask Auto Agent..."
              className="text-xs"
              disabled={isAiThinking}
            />
            <Button
              size="sm"
              onClick={handleSendMessage}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isAiThinking || !agentInput.trim()}
            >
              <Send className="w-3 h-3" />
            </Button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-slate-200 px-6 py-2 text-xs text-slate-600 flex items-center justify-between">
        <span>Ready</span>
        <span>{selectedCell}</span>
      </div>
    </div>
  );
}
