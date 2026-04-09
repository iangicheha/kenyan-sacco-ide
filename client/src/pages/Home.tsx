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
  Infinity,
  ClipboardList,
  Bug,
  MessageCircleQuestion,
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
  const [messages, setMessages] = useState<{ id: number; type: 'user' | 'bot'; text: string }[]>([]);
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
  const [aiMode, setAiMode] = useState<'agent' | 'plan' | 'debug' | 'ask'>('agent');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isLoadingMoreRows, setIsLoadingMoreRows] = useState(false);
  const [excelSortColumn, setExcelSortColumn] = useState<string | null>(null);
  const [excelSortDirection, setExcelSortDirection] = useState<'asc' | 'desc'>('asc');
  const [excelFilters, setExcelFilters] = useState<Record<string, string>>({});
  const [excelShowGridlines, setExcelShowGridlines] = useState(true);
  const [excelShowFilters, setExcelShowFilters] = useState(true);
  const [excelShowFormulas, setExcelShowFormulas] = useState(true);
  const [excelShowHeaders, setExcelShowHeaders] = useState(true);
  const [excelZoom, setExcelZoom] = useState(1);
  const [wordZoom, setWordZoom] = useState(1);
  const [excelFreezePanes, setExcelFreezePanes] = useState(true);
  const [excelViewMode, setExcelViewMode] = useState<'normal' | 'pageBreak'>('normal');
  const [wordLineHeight, setWordLineHeight] = useState(1.4);
  const [wordFontFamily, setWordFontFamily] = useState('Times New Roman');
  const [wordFontSize, setWordFontSize] = useState(14);
  const [wordHeader, setWordHeader] = useState('');
  const [wordFooter, setWordFooter] = useState('');
  const [wordMargins, setWordMargins] = useState(24);
  const [wordOrientation, setWordOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [wordPageSize, setWordPageSize] = useState<'A4' | 'Letter'>('A4');
  const [wordPreviewMode, setWordPreviewMode] = useState(false);
  const [uiLanguage, setUiLanguage] = useState('English');
  const wordTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [wordImages, setWordImages] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const [excelCellStyles, setExcelCellStyles] = useState<Record<string, React.CSSProperties>>({});
  const [excelValidationRules, setExcelValidationRules] = useState<Record<string, { type: 'numberRange'; min: number; max: number } | { type: 'regex'; pattern: string }>>({});

  const aiModeLabel = (mode: typeof aiMode) => {
    switch (mode) {
      case 'agent':
        return 'Agent';
      case 'plan':
        return 'Plan';
      case 'debug':
        return 'Debug';
      case 'ask':
        return 'Ask';
    }
  };

  const getSelectedExcelColumn = () => selectedCell?.slice(0, 1) || 'A';

  const handleSortSelectedColumn = (direction: 'asc' | 'desc') => {
    if (fileType !== 'excel') {
      toast.info('Sorting is available in Excel view.');
      return;
    }
    const col = getSelectedExcelColumn();
    setExcelSortColumn(col);
    setExcelSortDirection(direction);
    toast.success(`Sorted column ${col} (${direction.toUpperCase()}).`);
  };

  const handleToggleAutoFilter = () => {
    if (fileType !== 'excel') {
      toast.info('Filters are available in Excel view.');
      return;
    }
    setExcelShowFilters((prev) => !prev);
  };

  const handleToggleGridlines = () => {
    if (fileType !== 'excel') {
      toast.info('Gridlines are available in Excel view.');
      return;
    }
    setExcelShowGridlines((prev) => !prev);
  };

  const handleToggleShowFormulas = () => {
    if (fileType !== 'excel') {
      toast.info('Formulas display is available in Excel view.');
      return;
    }
    setExcelShowFormulas((prev) => !prev);
  };

  const handleToggleHeaders = () => {
    if (fileType !== 'excel') {
      toast.info('Headers toggle is available in Excel view.');
      return;
    }
    setExcelShowHeaders((prev) => !prev);
  };

  const handleToggleFreezePanes = () => {
    if (fileType !== 'excel') return toast.info('Freeze panes is available in Excel view.');
    setExcelFreezePanes((p) => !p);
  };

  const handleSetViewMode = (mode: 'normal' | 'pageBreak') => {
    if (fileType !== 'excel') return toast.info('View modes are available in Excel view.');
    setExcelViewMode(mode);
  };

  const colToIndex = (col: string) => col.toUpperCase().charCodeAt(0) - 65;
  const indexToCol = (idx: number) => String.fromCharCode(65 + idx);
  const nextCol = (col: string, offset: number) => indexToCol(Math.max(0, colToIndex(col) + offset));

  const handleTextToColumns = () => {
    if (fileType !== 'excel') return toast.info('Text to Columns is available in Excel view.');
    const delimiter = window.prompt('Delimiter (e.g. , or |)', ',');
    if (delimiter === null) return;
    const baseCol = selectedCell.slice(0, 1);
    const baseIdx = colToIndex(baseCol);
    const next = [...excelData];
    next.forEach((rowObj: any) => {
      const raw = String(rowObj?.[baseCol] ?? '');
      const parts = delimiter === '' ? [raw] : raw.split(delimiter);
      parts.forEach((part, i) => {
        const c = indexToCol(baseIdx + i);
        rowObj[c] = part.trim();
      });
    });
    setExcelData(next);
    addToHistory(next);
    toast.success('Text to Columns applied.');
  };

  const handleInsertFormula = (formula: string) => {
    if (fileType !== 'excel') return toast.info('Formulas are available in Excel view.');
    updateExcelCell(selectedCell, formula);
  };

  const handleApplyCommonFormula = (kind: 'SUM' | 'AVERAGE') => {
    if (fileType !== 'excel') return toast.info('Formulas are available in Excel view.');
    const col = selectedCell.slice(0, 1);
    const lastRow = Math.max(1, excelData.length);
    handleInsertFormula(`=${kind}(${col}1:${col}${lastRow})`);
  };

  const handleToday = () => handleInsertFormula('=TODAY()');
  const handleDate = () => {
    if (fileType !== 'excel') return toast.info('DATE is available in Excel view.');
    const y = window.prompt('Year', String(new Date().getFullYear()));
    if (!y) return;
    const m = window.prompt('Month (1-12)', '1');
    if (!m) return;
    const d = window.prompt('Day (1-31)', '1');
    if (!d) return;
    handleInsertFormula(`=DATE(${Number(y)},${Number(m)},${Number(d)})`);
  };

  const handleConcat = () => {
    if (fileType !== 'excel') return toast.info('CONCAT is available in Excel view.');
    const col = selectedCell.slice(0, 1);
    const row = selectedCell.slice(1);
    const c1 = `${col}${row}`;
    const c2 = `${nextCol(col, 1)}${row}`;
    handleInsertFormula(`=CONCAT(${c1},${c2})`);
  };

  const handleLen = () => {
    if (fileType !== 'excel') return toast.info('LEN is available in Excel view.');
    handleInsertFormula(`=LEN(${selectedCell})`);
  };

  const handleUpper = () => {
    if (fileType !== 'excel') return toast.info('UPPER is available in Excel view.');
    handleInsertFormula(`=UPPER(${selectedCell})`);
  };

  const handleZoomIn = () => {
    if (fileType === 'excel') setExcelZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))));
    else if (fileType === 'word') setWordZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))));
    else toast.info('Zoom is not available for this view yet.');
  };

  const handleZoomOut = () => {
    if (fileType === 'excel') setExcelZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))));
    else if (fileType === 'word') setWordZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))));
    else toast.info('Zoom is not available for this view yet.');
  };

  const updateExcelCell = (cellRef: string, nextValue: string) => {
    const col = cellRef.slice(0, 1);
    const row = parseInt(cellRef.slice(1), 10) - 1;
    const next = [...excelData];
    if (!next[row]) next[row] = {};
    (next[row] as any)[col] = nextValue;
    setExcelData(next);
    addToHistory(next);
  };

  const updateExcelCellStyle = (cellRef: string, patch: React.CSSProperties) => {
    setExcelCellStyles((prev) => ({
      ...prev,
      [cellRef]: {
        ...(prev[cellRef] || {}),
        ...patch,
      },
    }));
  };

  const toggleExcelStyleFlag = (cellRef: string, key: 'fontWeight' | 'fontStyle' | 'textDecoration') => {
    const current = excelCellStyles[cellRef] || {};
    if (key === 'fontWeight') {
      updateExcelCellStyle(cellRef, { fontWeight: current.fontWeight === 'bold' ? 'normal' : 'bold' });
      return;
    }
    if (key === 'fontStyle') {
      updateExcelCellStyle(cellRef, { fontStyle: current.fontStyle === 'italic' ? 'normal' : 'italic' });
      return;
    }
    const next = current.textDecoration === 'underline' ? 'none' : 'underline';
    updateExcelCellStyle(cellRef, { textDecoration: next });
  };

  const handleExcelAlignment = (align: 'left' | 'center' | 'right' | 'justify') => {
    if (fileType !== 'excel') return toast.info('Alignment is available in Excel view.');
    updateExcelCellStyle(selectedCell, { textAlign: align as any });
  };

  const handleParagraphIndent = (direction: 'increase' | 'decrease') => {
    if (fileType !== 'word') return toast.info('Indent is available in Word view.');
    const sel = wordSelection || { start: 0, end: 0 };
    const start = Math.min(sel.start, sel.end);
    const end = Math.max(sel.start, sel.end);
    const before = wordContent.slice(0, start);
    const target = wordContent.slice(start, end);
    const after = wordContent.slice(end);
    const lines = target.length ? target.split('\n') : [wordContent];
    const updated = lines
      .map((line) => {
        if (direction === 'increase') return `  ${line}`;
        return line.startsWith('  ') ? line.slice(2) : line;
      })
      .join('\n');
    const nextContent = target.length ? before + updated + after : updated;
    setWordContent(nextContent);
  };

  const handleParagraphSpacingToggle = () => {
    if (fileType !== 'word') return toast.info('Paragraph spacing is available in Word view.');
    setWordLineHeight((h) => (h >= 1.7 ? 1.4 : 1.8));
  };

  const insertIntoWordAtCursor = (text: string) => {
    const el = wordTextareaRef.current;
    if (!el) {
      setWordContent((prev) => prev + text);
      return;
    }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const before = wordContent.slice(0, start);
    const after = wordContent.slice(end);
    const next = before + text + after;
    setWordContent(next);
    setTimeout(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleInsertTable = () => {
    if (fileType !== 'word') return toast.info('Insert table is available in Word view.');
    insertIntoWordAtCursor('\n| Column 1 | Column 2 |\n|---|---|\n| Value 1 | Value 2 |\n\n');
  };

  const handleInsertHyperlink = () => {
    if (fileType !== 'word') return toast.info('Hyperlink is available in Word view.');
    const url = window.prompt('Enter URL');
    if (!url) return;
    insertIntoWordAtCursor(`[link](${url})`);
  };

  const handleApplyHeading = (level: 1 | 2) => {
    if (fileType !== 'word') return toast.info('Headings are available in Word view.');
    setWordFontFamily('Times New Roman');
    setWordFontSize(level === 1 ? 22 : 18);
    setWordFormatting((p) => ({ ...p, bold: true }));
  };

  const handleFormatPercent = () => {
    if (fileType !== 'excel') return toast.info('Percent format is available in Excel view.');
    const ref = selectedCell;
    const row = parseInt(ref.slice(1), 10) - 1;
    const col = ref.slice(0, 1);
    const raw = String((excelData[row] as any)?.[col] ?? '').trim();
    if (!raw) return;
    const num = Number(raw.replace(/%/g, ''));
    if (Number.isNaN(num)) return toast.error('Selected cell is not a number.');
    updateExcelCell(ref, `${num}%`);
  };

  const handleFormatCurrency = () => {
    if (fileType !== 'excel') return toast.info('Currency format is available in Excel view.');
    const ref = selectedCell;
    const row = parseInt(ref.slice(1), 10) - 1;
    const col = ref.slice(0, 1);
    const raw = String((excelData[row] as any)?.[col] ?? '').trim();
    if (!raw) return;
    const cleaned = raw.replace(/^KES\s+/i, '').replace(/,/g, '');
    const num = Number(cleaned);
    if (Number.isNaN(num)) return toast.error('Selected cell is not a number.');
    updateExcelCell(ref, `KES ${num.toLocaleString()}`);
  };

  const handleInsertRow = () => {
    if (fileType !== 'excel') return toast.info('Insert row is available in Excel view.');
    const rowIndex = Math.max(0, parseInt(selectedCell.slice(1), 10) - 1);
    const next = [...excelData];
    next.splice(rowIndex, 0, {});
    setExcelData(next);
    addToHistory(next);
    toast.success(`Inserted row ${rowIndex + 1}.`);
  };

  const handleDeleteRow = () => {
    if (fileType !== 'excel') return toast.info('Delete row is available in Excel view.');
    const rowIndex = Math.max(0, parseInt(selectedCell.slice(1), 10) - 1);
    if (excelData.length === 0) return;
    const next = [...excelData];
    next.splice(rowIndex, 1);
    setExcelData(next);
    addToHistory(next);
    toast.success(`Deleted row ${rowIndex + 1}.`);
  };

  const handleFind = () => {
    if (fileType === 'word') {
      const q = window.prompt('Find text');
      if (!q) return;
      const idx = wordContent.toLowerCase().indexOf(q.toLowerCase());
      if (idx === -1) return toast.info('Not found.');
      setWordSelection({ start: idx, end: idx + q.length });
      setTimeout(() => {
        const el = wordTextareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(idx, idx + q.length);
      }, 0);
      return;
    }
    if (fileType === 'excel') {
      const q = window.prompt('Find value in sheet');
      if (!q) return;
      const lower = q.toLowerCase();
      for (let r = 0; r < excelData.length; r++) {
        const row = excelData[r] as any;
        for (const col of Object.keys(row || {})) {
          const val = String(row?.[col] ?? '');
          if (val.toLowerCase().includes(lower)) {
            setSelectedCell(`${col}${r + 1}`);
            toast.success(`Found in ${col}${r + 1}.`);
            return;
          }
        }
      }
      toast.info('Not found.');
      return;
    }
    toast.info('Find is not available for this view.');
  };

  const handleReplace = () => {
    if (fileType !== 'word') return toast.info('Replace is available in Word view.');
    const find = window.prompt('Find text');
    if (!find) return;
    const replace = window.prompt('Replace with', '');
    if (replace === null) return;
    const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const next = wordContent.replace(re, replace);
    setWordContent(next);
    toast.success('Replace complete.');
  };

  const handleSelectAll = () => {
    if (fileType === 'word') {
      setTimeout(() => {
        const el = wordTextareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(0, el.value.length);
      }, 0);
      return;
    }
    if (fileType === 'excel') {
      setSelectedCell('A1');
      toast.info('Select-all is not supported for the grid yet (cell selection only).');
      return;
    }
    toast.info('Select-all is not available for this view.');
  };

  const handleInsertPicture = () => {
    if (fileType !== 'word') return toast.info('Pictures are supported in Word view.');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setWordImages((prev) => [...prev, { id, name: file.name, url }]);
      insertIntoWordAtCursor(`\n[[image:${id}]]\n`);
    };
    input.click();
  };

  const handleInsertChart = () => {
    if (fileType !== 'excel') return toast.info('Charts are supported in Excel view.');
    const col = selectedCell.slice(0, 1);
    const nums: number[] = [];
    excelData.forEach((r: any) => {
      const v = Number(String(r?.[col] ?? '').replace(/,/g, '').replace(/^KES\s+/i, '').replace(/%/g, ''));
      if (Number.isFinite(v)) nums.push(v);
    });
    if (nums.length === 0) return toast.info('No numeric values found in selected column.');
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = sum / nums.length;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    toast.success(`Chart summary for column ${col}: min=${min.toFixed(2)} max=${max.toFixed(2)} avg=${avg.toFixed(2)}`);
  };

  const handleInsertShapes = () => {
    if (fileType !== 'word') return toast.info('Shapes are supported in Word view.');
    insertIntoWordAtCursor('\n[Shape]\n[########]\n\n');
  };

  const handleInsertTextBox = () => {
    if (fileType !== 'word') return toast.info('Text boxes are supported in Word view.');
    insertIntoWordAtCursor('\n[Text Box]\n----------------\nYour text here...\n----------------\n\n');
  };

  const handleInsertHeader = () => {
    if (fileType !== 'word') return toast.info('Header is supported in Word view.');
    const v = window.prompt('Header text', wordHeader);
    if (v === null) return;
    setWordHeader(v);
  };

  const handleInsertFooter = () => {
    if (fileType !== 'word') return toast.info('Footer is supported in Word view.');
    const v = window.prompt('Footer text', wordFooter);
    if (v === null) return;
    setWordFooter(v);
  };

  const handleInsertBookmark = () => {
    if (fileType !== 'word') return toast.info('Bookmarks are supported in Word view.');
    const name = window.prompt('Bookmark name');
    if (!name) return;
    insertIntoWordAtCursor(`[[bookmark:${name}]]`);
  };

  const handleSetMargins = () => {
    if (fileType !== 'word') return toast.info('Margins are supported in Word view.');
    const v = window.prompt('Margins (px)', String(wordMargins));
    if (!v) return;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return toast.error('Invalid margin.');
    setWordMargins(n);
  };

  const handleOrientation = () => {
    if (fileType !== 'word') return toast.info('Orientation is supported in Word view.');
    setWordOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'));
  };

  const handlePageSize = () => {
    if (fileType !== 'word') return toast.info('Page size is supported in Word view.');
    setWordPageSize((s) => (s === 'A4' ? 'Letter' : 'A4'));
  };

  const handleToggleWordPreview = () => {
    if (fileType !== 'word') return toast.info('Preview is available in Word view.');
    setWordPreviewMode((p) => !p);
  };

  const handleThemeColors = () => {
    if (fileType !== 'word') return toast.info('Theme colors are supported in Word view.');
    const v = window.prompt('Theme background (e.g. white, #f8fafc)', '#ffffff');
    if (!v) return;
    insertIntoWordAtCursor(`\n[ThemeColor:${v}]\n`);
  };

  const handleThemeFonts = () => {
    if (fileType !== 'word') return toast.info('Theme fonts are supported in Word view.');
    const f = window.prompt('Font family', wordFontFamily);
    if (!f) return;
    setWordFontFamily(f);
  };

  const handleOpenPreferences = () => {
    const current = [
      `Language: ${uiLanguage}`,
      `Excel: gridlines=${excelShowGridlines ? 'on' : 'off'}, filters=${excelShowFilters ? 'on' : 'off'}, headers=${excelShowHeaders ? 'on' : 'off'}, formulas=${excelShowFormulas ? 'on' : 'off'}`,
      `Word: font=${wordFontFamily} ${wordFontSize}px, margins=${wordMargins}px, orientation=${wordOrientation}, page=${wordPageSize}`,
    ].join('\n');
    window.alert(`Preferences (current)\n\n${current}`);
  };

  const handleChangeLanguage = () => {
    const next = window.prompt('Language', uiLanguage);
    if (!next) return;
    setUiLanguage(next);
    toast.success(`Language set to ${next}.`);
  };

  const handleOpenHelp = () => {
    window.alert(
      [
        'Help',
        '',
        '- Excel: select a cell then use ribbon (formatting, sort/filter, formulas, validation, subtotals).',
        '- Word: use ribbon (styles, spacing, header/footer, links).',
        '- AI: open the AI button bottom-right.',
      ].join('\n')
    );
  };

  const handleAbout = () => {
    window.alert('SACCO IDE\n\nA lightweight Excel/Word-style review workspace.\n');
  };

  const handleSubtotals = () => {
    if (fileType !== 'excel') return toast.info('Subtotals are available in Excel view.');
    const groupCol = window.prompt('Group by column (A-Z)', selectedCell.slice(0, 1)) || '';
    const sumCol = window.prompt('Sum column (A-Z)', nextCol(selectedCell.slice(0, 1), 1)) || '';
    const g = groupCol.trim().toUpperCase().slice(0, 1);
    const s = sumCol.trim().toUpperCase().slice(0, 1);
    if (!g || !s) return;
    const sorted = [...excelData].sort((a: any, b: any) => String(a?.[g] ?? '').localeCompare(String(b?.[g] ?? '')));
    const out: any[] = [];
    let current = null as string | null;
    let subtotal = 0;
    const flush = () => {
      if (current === null) return;
      const row: any = {};
      row[g] = `${current} subtotal`;
      row[s] = subtotal;
      out.push(row);
    };
    sorted.forEach((row: any) => {
      const key = String(row?.[g] ?? '');
      if (current !== null && key !== current) {
        flush();
        subtotal = 0;
      }
      current = key;
      const v = Number(String(row?.[s] ?? '').replace(/,/g, '').replace(/^KES\s+/i, '').replace(/%/g, ''));
      if (Number.isFinite(v)) subtotal += v;
      out.push(row);
    });
    flush();
    setExcelData(out as any);
    addToHistory(out as any);
    toast.success('Subtotals inserted.');
  };

  const handleValidation = () => {
    if (fileType !== 'excel') return toast.info('Validation is available in Excel view.');
    const col = window.prompt('Apply validation to column (A-Z)', selectedCell.slice(0, 1));
    if (!col) return;
    const c = col.trim().toUpperCase().slice(0, 1);
    const type = window.prompt('Type: "range" or "regex"', 'range');
    if (!type) return;
    if (type.toLowerCase().startsWith('r')) {
      const min = Number(window.prompt('Min', '0'));
      const max = Number(window.prompt('Max', '100'));
      if (!Number.isFinite(min) || !Number.isFinite(max)) return toast.error('Invalid range.');
      setExcelValidationRules((p) => ({ ...p, [c]: { type: 'numberRange', min, max } }));
      toast.success(`Validation set for ${c}: ${min}..${max}`);
      return;
    }
    const pattern = window.prompt('Regex pattern (e.g. ^\\d{4}-\\d{2}-\\d{2}$ )', '^.*$');
    if (!pattern) return;
    setExcelValidationRules((p) => ({ ...p, [c]: { type: 'regex', pattern } }));
    toast.success(`Validation set for ${c}: /${pattern}/`);
  };

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
      const response = await fetch('http://localhost:3001/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          tableName: currentFileMeta?.name && currentSheetName
            ? `${currentFileMeta.name}::${currentSheetName}`
            : undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Chat failed (${response.status}) ${body}`.trim());
      }
      const result = await response.json();
      const aiMessage = result?.ok
        ? `${result.execution?.summary ?? 'Execution complete.'} Result: ${JSON.stringify(result.execution?.result)}`
        : `AI error: ${result?.error ?? 'Unknown AI error'}`;
      setMessages((prev) => [...prev, { id: Date.now() + 1, type: 'bot', text: aiMessage }]);
      setPendingOperations([]);
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

        setSessionId('api-v2');
        setPendingOperations([]);
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

  const RibbonButton = ({ icon: Icon, label, onClick, active }: any) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded transition-colors group min-w-fit ${
        active ? 'bg-blue-100 ring-1 ring-blue-200' : 'hover:bg-blue-50'
      }`}
      title={label}
    >
      <Icon className={`w-3.5 h-3.5 ${active ? 'text-blue-700' : 'text-slate-600 group-hover:text-blue-600'}`} />
      <span className={`text-xs whitespace-nowrap ${active ? 'text-blue-700' : 'text-slate-600 group-hover:text-blue-600'}`}>
        {label}
      </span>
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
    <div className="h-full flex flex-col" style={{ zoom: excelZoom }}>
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
        cellStyles={excelCellStyles}
        showHeaders={excelShowHeaders}
        showGridlines={excelShowGridlines}
        showFilters={excelShowFilters}
        showFormulas={excelShowFormulas}
        freezePanes={excelFreezePanes}
        viewMode={excelViewMode}
        onCommitCell={(cellRef, nextValue) => {
          const col = cellRef.slice(0, 1);
          const rule = excelValidationRules[col];
          if (!rule) return true;
          if (rule.type === 'numberRange') {
            const n = Number(String(nextValue).replace(/,/g, '').replace(/^KES\s+/i, '').replace(/%/g, ''));
            if (!Number.isFinite(n)) return `Validation failed: ${col} must be a number.`;
            if (n < rule.min || n > rule.max) return `Validation failed: ${col} must be between ${rule.min} and ${rule.max}.`;
            return true;
          }
          try {
            const re = new RegExp(rule.pattern);
            if (!re.test(String(nextValue))) return `Validation failed: ${col} must match /${rule.pattern}/.`;
            return true;
          } catch {
            return 'Validation rule has an invalid regex.';
          }
        }}
        sortColumn={excelSortColumn}
        sortDirection={excelSortDirection}
        onSortChange={(col, dir) => {
          setExcelSortColumn(col);
          setExcelSortDirection(dir);
        }}
        filters={excelFilters}
        onFiltersChange={setExcelFilters}
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
    <div className="flex flex-col h-full w-full bg-slate-100 overflow-hidden">
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

      {/* Page canvas */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto">
          <div
            className="bg-white shadow-sm border border-slate-200"
            style={{
              width:
                (wordPageSize === 'A4'
                  ? (wordOrientation === 'portrait' ? 794 : 1123)
                  : (wordOrientation === 'portrait' ? 816 : 1056)) * wordZoom,
              minHeight:
                (wordPageSize === 'A4'
                  ? (wordOrientation === 'portrait' ? 1123 : 794)
                  : (wordOrientation === 'portrait' ? 1056 : 816)) * wordZoom,
            }}
          >
            {wordHeader.trim() !== '' && (
              <div className="px-6 py-2 text-xs text-slate-600 border-b border-slate-200 bg-white">
                {wordHeader}
              </div>
            )}
            {wordPreviewMode ? (
              <div
                className="w-full text-sm font-serif whitespace-pre-wrap break-words"
                style={{
                  minHeight:
                    (wordPageSize === 'A4'
                      ? (wordOrientation === 'portrait' ? 1123 : 794)
                      : (wordOrientation === 'portrait' ? 1056 : 816)) * wordZoom - (wordHeader.trim() ? 32 : 0) - (wordFooter.trim() ? 32 : 0),
                  lineHeight: wordLineHeight,
                  fontFamily: wordFontFamily,
                  fontSize: `${wordFontSize}px`,
                  padding: `${wordMargins}px`,
                  fontWeight: wordFormatting.bold ? 'bold' : 'normal',
                  fontStyle: wordFormatting.italic ? 'italic' : 'normal',
                  textDecoration: wordFormatting.underline ? 'underline' : 'none',
                }}
              >
                {wordContent.split(/(\[\[image:[^\]]+\]\])/g).map((part, idx) => {
                  const match = part.match(/^\[\[image:([^\]]+)\]\]$/);
                  if (!match) return <span key={`txt-${idx}`}>{part}</span>;
                  const imageId = match[1];
                  const image = wordImages.find((img) => img.id === imageId);
                  if (!image) {
                    return (
                      <span key={`missing-${idx}`} className="inline-block px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs">
                        Missing image: {imageId}
                      </span>
                    );
                  }
                  return (
                    <img
                      key={`img-${idx}`}
                      src={image.url}
                      alt={image.name}
                      className="my-2 max-w-full rounded border border-slate-200"
                    />
                  );
                })}
              </div>
            ) : (
              <textarea
                ref={wordTextareaRef}
                value={wordContent}
                onChange={(e) => setWordContent(e.target.value)}
                onSelect={(e) => setWordSelection({ start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })}
                className="w-full border-0 outline-0 resize-none text-sm font-serif"
                style={{
                  minHeight:
                    (wordPageSize === 'A4'
                      ? (wordOrientation === 'portrait' ? 1123 : 794)
                      : (wordOrientation === 'portrait' ? 1056 : 816)) * wordZoom - (wordHeader.trim() ? 32 : 0) - (wordFooter.trim() ? 32 : 0),
                  lineHeight: wordLineHeight,
                  fontFamily: wordFontFamily,
                  fontSize: `${wordFontSize}px`,
                  padding: `${wordMargins}px`,
                  fontWeight: wordFormatting.bold ? 'bold' : 'normal',
                  fontStyle: wordFormatting.italic ? 'italic' : 'normal',
                  textDecoration: wordFormatting.underline ? 'underline' : 'none',
                }}
              />
            )}

            {wordFooter.trim() !== '' && (
              <div className="px-6 py-2 text-xs text-slate-600 border-t border-slate-200 bg-white">
                {wordFooter}
              </div>
            )}
          </div>

          {/* Inserted images gallery */}
          {wordImages.length > 0 && (
            <div className="mt-4 rounded border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">Images</div>
              <div className="grid grid-cols-3 gap-2">
                {wordImages.slice(-9).map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    className="border border-slate-200 rounded overflow-hidden hover:border-blue-300 transition-colors"
                    title={img.name}
                    onClick={() => insertIntoWordAtCursor(`\n[[image:${img.id}]]\n`)}
                  >
                    <img src={img.url} alt={img.name} className="w-full h-20 object-cover" />
                    <div className="px-2 py-1 text-[10px] text-slate-600 truncate">{img.name}</div>
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-slate-500">
                Tip: clicking an image inserts its token into the document.
              </div>
            </div>
          )}
        </div>
      </div>
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
                  <RibbonButton
                    icon={Type}
                    label="Apply"
                    onClick={() => {
                      if (fileType === 'excel') {
                        updateExcelCellStyle(selectedCell, { fontFamily, fontSize: `${fontSize}px` });
                      } else if (fileType === 'word') {
                        setWordFontFamily(fontFamily);
                        setWordFontSize(Number(fontSize));
                      } else {
                        toast.info('Font settings are available in Word/Excel view.');
                      }
                    }}
                  />
                  <RibbonButton
                    icon={Bold}
                    label="Bold"
                    active={fileType === 'word'
                      ? wordFormatting.bold
                      : fileType === 'excel'
                        ? (excelCellStyles[selectedCell]?.fontWeight === 'bold')
                        : false}
                    onClick={() => {
                      if (fileType === 'word') setWordFormatting((p) => ({ ...p, bold: !p.bold }));
                      else if (fileType === 'excel') toggleExcelStyleFlag(selectedCell, 'fontWeight');
                      else toast.info('Bold is available in Word/Excel view.');
                    }}
                  />
                  <RibbonButton
                    icon={Italic}
                    label="Italic"
                    active={fileType === 'word'
                      ? wordFormatting.italic
                      : fileType === 'excel'
                        ? (excelCellStyles[selectedCell]?.fontStyle === 'italic')
                        : false}
                    onClick={() => {
                      if (fileType === 'word') setWordFormatting((p) => ({ ...p, italic: !p.italic }));
                      else if (fileType === 'excel') toggleExcelStyleFlag(selectedCell, 'fontStyle');
                      else toast.info('Italic is available in Word/Excel view.');
                    }}
                  />
                  <RibbonButton
                    icon={Underline}
                    label="Underline"
                    active={fileType === 'word'
                      ? wordFormatting.underline
                      : fileType === 'excel'
                        ? (excelCellStyles[selectedCell]?.textDecoration === 'underline')
                        : false}
                    onClick={() => {
                      if (fileType === 'word') setWordFormatting((p) => ({ ...p, underline: !p.underline }));
                      else if (fileType === 'excel') toggleExcelStyleFlag(selectedCell, 'textDecoration');
                      else toast.info('Underline is available in Word/Excel view.');
                    }}
                  />
                </RibbonGroup>

                <RibbonGroup title="Alignment">
                  <RibbonButton
                    icon={AlignLeft}
                    label="Left"
                    active={fileType === 'excel' && (excelCellStyles[selectedCell]?.textAlign === 'left' || !excelCellStyles[selectedCell]?.textAlign)}
                    onClick={() => handleExcelAlignment('left')}
                  />
                  <RibbonButton
                    icon={AlignCenter}
                    label="Center"
                    active={fileType === 'excel' && excelCellStyles[selectedCell]?.textAlign === 'center'}
                    onClick={() => handleExcelAlignment('center')}
                  />
                  <RibbonButton
                    icon={AlignRight}
                    label="Right"
                    active={fileType === 'excel' && excelCellStyles[selectedCell]?.textAlign === 'right'}
                    onClick={() => handleExcelAlignment('right')}
                  />
                  <RibbonButton
                    icon={AlignJustify}
                    label="Justify"
                    active={fileType === 'excel' && excelCellStyles[selectedCell]?.textAlign === 'justify'}
                    onClick={() => handleExcelAlignment('justify')}
                  />
                </RibbonGroup>

                <RibbonGroup title="Number">
                  <RibbonButton icon={Percent} label="Percent" onClick={handleFormatPercent} />
                  <RibbonButton icon={DollarSign} label="Currency" onClick={handleFormatCurrency} />
                </RibbonGroup>

                <RibbonGroup title="Cells">
                  <RibbonButton icon={Plus} label="Insert" onClick={handleInsertRow} />
                  <RibbonButton icon={Trash2} label="Delete" onClick={handleDeleteRow} />
                  <RibbonButton icon={Settings} label="Format" onClick={() => toast.info('Cell styling not implemented yet.')} />
                </RibbonGroup>

                <RibbonGroup title="Paragraph">
                  <RibbonButton icon={ChevronUp} label="Increase" onClick={() => handleParagraphIndent('increase')} />
                  <RibbonButton icon={ChevronDown} label="Decrease" onClick={() => handleParagraphIndent('decrease')} />
                  <RibbonButton icon={List} label="Spacing" onClick={handleParagraphSpacingToggle} />
                </RibbonGroup>

                <RibbonGroup title="Styles">
                  <RibbonButton icon={Type} label="Normal" onClick={() => {
                    if (fileType !== 'word') return toast.info('Styles are available in Word view.');
                    setWordFontFamily('Times New Roman');
                    setWordFontSize(14);
                    setWordFormatting({ bold: false, italic: false, underline: false });
                  }} />
                  <RibbonButton icon={BarChart3} label="Heading 1" onClick={() => handleApplyHeading(1)} />
                  <RibbonButton icon={BarChart3} label="Heading 2" onClick={() => handleApplyHeading(2)} />
                </RibbonGroup>

                <RibbonGroup title="Editing">
                  <RibbonButton icon={Filter} label="Find" onClick={handleFind} />
                  <RibbonButton icon={Zap} label="Replace" onClick={handleReplace} />
                  <RibbonButton icon={Eye} label="Select" onClick={handleSelectAll} />
                </RibbonGroup>
              </div>
            )}

            {/* INSERT TAB */}
            {ribbonExpanded && activeTab === 'insert' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Tables">
                  <RibbonButton icon={Grid} label="Table" onClick={handleInsertTable} />
                </RibbonGroup>
                <RibbonGroup title="Illustrations">
                  <RibbonButton icon={Image} label="Picture" onClick={handleInsertPicture} />
                  <RibbonButton icon={BarChart3} label="Chart" onClick={handleInsertChart} />
                  <RibbonButton icon={Plus} label="Shapes" onClick={handleInsertShapes} />
                </RibbonGroup>
                <RibbonGroup title="Text">
                  <RibbonButton icon={Type} label="Text Box" onClick={handleInsertTextBox} />
                  <RibbonButton icon={FileText} label="Header" onClick={handleInsertHeader} />
                  <RibbonButton icon={FileText} label="Footer" onClick={handleInsertFooter} />
                </RibbonGroup>
                <RibbonGroup title="Links">
                  <RibbonButton icon={Link} label="Hyperlink" onClick={handleInsertHyperlink} />
                  <RibbonButton icon={BookOpen} label="Bookmark" onClick={handleInsertBookmark} />
                </RibbonGroup>
              </div>
            )}

            {/* PAGE LAYOUT TAB */}
            {ribbonExpanded && activeTab === 'layout' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Page Setup">
                  <RibbonButton icon={Columns} label="Margins" onClick={handleSetMargins} />
                  <RibbonButton
                    icon={Maximize2}
                    label="Orientation"
                    active={fileType === 'word' && wordOrientation === 'landscape'}
                    onClick={handleOrientation}
                  />
                  <RibbonButton
                    icon={Grid}
                    label="Size"
                    active={fileType === 'word' && wordPageSize === 'Letter'}
                    onClick={handlePageSize}
                  />
                </RibbonGroup>
                <RibbonGroup title="Sheet Options">
                  <RibbonButton icon={Eye} label="Freeze Panes" active={fileType === 'excel' && excelFreezePanes} onClick={handleToggleFreezePanes} />
                  <RibbonButton icon={Grid} label="Gridlines" onClick={handleToggleGridlines} />
                </RibbonGroup>
                <RibbonGroup title="Themes">
                  <RibbonButton icon={Palette} label="Colors" onClick={handleThemeColors} />
                  <RibbonButton icon={Type} label="Fonts" onClick={handleThemeFonts} />
                </RibbonGroup>
              </div>
            )}

            {/* FORMULAS TAB */}
            {ribbonExpanded && activeTab === 'formulas' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Financial">
                  <RibbonButton icon={Sigma} label="SUM" onClick={() => handleApplyCommonFormula('SUM')} />
                  <RibbonButton icon={TrendingUp} label="AVERAGE" onClick={() => handleApplyCommonFormula('AVERAGE')} />
                  <RibbonButton icon={DollarSign} label="PMT" onClick={() => handleInsertFormula('=PMT(0.1/12,12,-10000)')} />
                  <RibbonButton icon={BarChart3} label="NPV" onClick={() => handleInsertFormula('=NPV(0.1,1000,1000,1000)')} />
                </RibbonGroup>
                <RibbonGroup title="Logical">
                  <RibbonButton icon={Zap} label="IF" onClick={() => handleInsertFormula('=IF(A1>0,\"YES\",\"NO\")')} />
                  <RibbonButton icon={Zap} label="AND" onClick={() => handleInsertFormula('=AND(A1>0,B1>0)')} />
                  <RibbonButton icon={Zap} label="OR" onClick={() => handleInsertFormula('=OR(A1>0,B1>0)')} />
                </RibbonGroup>
                <RibbonGroup title="Text">
                  <RibbonButton icon={Type} label="CONCAT" onClick={handleConcat} />
                  <RibbonButton icon={Type} label="LEN" onClick={handleLen} />
                  <RibbonButton icon={Type} label="UPPER" onClick={handleUpper} />
                </RibbonGroup>
                <RibbonGroup title="Date & Time">
                  <RibbonButton icon={Calendar} label="TODAY" onClick={handleToday} />
                  <RibbonButton icon={Calendar} label="DATE" onClick={handleDate} />
                </RibbonGroup>
              </div>
            )}
          </div>

            {/* DATA TAB */}
            {ribbonExpanded && activeTab === 'data' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Sort & Filter">
                  <RibbonButton icon={ArrowUp} label="Sort A-Z" onClick={() => handleSortSelectedColumn('asc')} />
                  <RibbonButton icon={ArrowDown} label="Sort Z-A" onClick={() => handleSortSelectedColumn('desc')} />
                  <RibbonButton icon={Filter} label="AutoFilter" active={fileType === 'excel' && excelShowFilters} onClick={handleToggleAutoFilter} />
                </RibbonGroup>
                <RibbonGroup title="Data Tools">
                  <RibbonButton icon={BarChart3} label="Subtotals" onClick={handleSubtotals} />
                  <RibbonButton icon={Grid} label="Validation" onClick={handleValidation} />
                  <RibbonButton icon={Zap} label="Text to Columns" onClick={handleTextToColumns} />
                </RibbonGroup>
              </div>
            )}

            {/* VIEW TAB */}
            {ribbonExpanded && activeTab === 'view' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Workbook Views">
                  <RibbonButton icon={Eye} label="Normal" active={fileType === 'excel' && excelViewMode === 'normal'} onClick={() => handleSetViewMode('normal')} />
                  <RibbonButton icon={Eye} label="Page Break" active={fileType === 'excel' && excelViewMode === 'pageBreak'} onClick={() => handleSetViewMode('pageBreak')} />
                  <RibbonButton icon={Eye} label="Preview" active={fileType === 'word' && wordPreviewMode} onClick={handleToggleWordPreview} />
                </RibbonGroup>
                <RibbonGroup title="Show/Hide">
                  <RibbonButton icon={Eye} label="Gridlines" active={fileType === 'excel' && excelShowGridlines} onClick={handleToggleGridlines} />
                  <RibbonButton icon={Eye} label="Headers" active={fileType === 'excel' && excelShowHeaders} onClick={handleToggleHeaders} />
                  <RibbonButton icon={Eye} label="Formulas" active={fileType === 'excel' && excelShowFormulas} onClick={handleToggleShowFormulas} />
                </RibbonGroup>
                <RibbonGroup title="Zoom">
                  <RibbonButton icon={ZoomIn} label="Zoom In" onClick={handleZoomIn} />
                  <RibbonButton icon={ZoomOut} label="Zoom Out" onClick={handleZoomOut} />
                </RibbonGroup>
              </div>
            )}

            {/* SETTINGS TAB */}
            {ribbonExpanded && activeTab === 'settings' && (
              <div className="flex gap-0.5 p-2 overflow-x-auto">
                <RibbonGroup title="Options">
                  <RibbonButton icon={Settings} label="Preferences" onClick={handleOpenPreferences} />
                  <RibbonButton icon={Settings} label="Language" onClick={handleChangeLanguage} />
                </RibbonGroup>
                <RibbonGroup title="Help">
                  <RibbonButton icon={HelpCircle} label="Help" onClick={handleOpenHelp} />
                  <RibbonButton icon={Info} label="About" onClick={handleAbout} />
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
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-slate-200">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Mode
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-2 px-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    title="AI mode"
                  >
                    <Infinity className="h-4 w-4" />
                    <span className="text-xs font-semibold">{aiModeLabel(aiMode)}</span>
                    <ChevronDown className="h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => setAiMode('agent')} className="gap-2">
                    <Infinity className="h-4 w-4" />
                    <span>Agent</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAiMode('plan')} className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    <span>Plan</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAiMode('debug')} className="gap-2">
                    <Bug className="h-4 w-4" />
                    <span>Debug</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAiMode('ask')} className="gap-2">
                    <MessageCircleQuestion className="h-4 w-4" />
                    <span>Ask</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex gap-2">
              <Input
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask the assistant..."
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
