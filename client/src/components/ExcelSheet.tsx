import React, { useState, useRef, useEffect } from 'react';
import { parseFormula } from '@/lib/formulaParser';
import { ArrowDownUp, Check, X } from 'lucide-react';

interface ExcelSheetProps {
  data: any[];
  onDataChange: (newData: any[]) => void;
  selectedCell: string;
  onCellSelect: (cell: string) => void;
  editingCell: string | null;
  onEditStart: (cell: string) => void;
  onEditEnd: () => void;
  columnHeaders?: string[];
  onLoadMoreRows?: () => void;
  canLoadMoreRows?: boolean;
  isLoadingMoreRows?: boolean;
  showHeaders?: boolean;
  showGridlines?: boolean;
  showFilters?: boolean;
  showFormulas?: boolean;
  cellStyles?: Record<string, React.CSSProperties>;
  freezePanes?: boolean;
  viewMode?: 'normal' | 'pageBreak';
  onCommitCell?: (cellRef: string, nextValue: string) => true | string;
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (col: string | null, direction: 'asc' | 'desc') => void;
  filters?: Record<string, string>;
  onFiltersChange?: (filters: Record<string, string>) => void;
}

export const ExcelSheet: React.FC<ExcelSheetProps> = ({
  data,
  onDataChange,
  selectedCell,
  onCellSelect,
  editingCell,
  onEditStart,
  onEditEnd,
  columnHeaders = [],
  onLoadMoreRows,
  canLoadMoreRows = false,
  isLoadingMoreRows = false,
  showHeaders = true,
  showGridlines = true,
  showFilters = true,
  showFormulas = true,
  cellStyles = {},
  freezePanes = true,
  viewMode = 'normal',
  onCommitCell,
  sortColumn: sortColumnProp,
  sortDirection: sortDirectionProp,
  onSortChange,
  filters: filtersProp,
  onFiltersChange,
}) => {
  const [editingValue, setEditingValue] = useState('');
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const [sortColumnInternal, setSortColumnInternal] = useState<string | null>(null);
  const [sortDirectionInternal, setSortDirectionInternal] = useState<'asc' | 'desc'>('asc');
  const [filtersInternal, setFiltersInternal] = useState<Record<string, string>>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const downArrowCursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'><path d='M10 1v12' stroke='black' stroke-width='2.8' stroke-linecap='round'/><path d='M6 10l4 6 4-6' fill='black'/></svg>") 10 2, s-resize`;
  const isPageLayoutMode = viewMode === 'pageBreak';
  const pageWidth = 1120;
  const pageMinHeight = 780;
  const marginTop = 56;
  const marginBottom = 56;
  const marginLeft = 48;
  const marginRight = 48;
  const sortColumn = sortColumnProp ?? sortColumnInternal;
  const sortDirection = sortDirectionProp ?? sortDirectionInternal;
  const filters = filtersProp ?? filtersInternal;
  const selectedMatch = /^([A-Z]+)(\d+)$/i.exec(selectedCell || '');
  const selectedColRef = selectedMatch?.[1]?.toUpperCase() ?? '';
  const selectedRowRef = selectedMatch ? Number(selectedMatch[2]) : 0;
  const cols = React.useMemo(() => {
    const keys = new Set<string>();
    data.forEach((row) => Object.keys(row || {}).forEach((k) => keys.add(k)));
    const sorted = Array.from(keys).sort();
    return sorted.length > 0 ? sorted : ['A', 'B', 'C', 'D'];
  }, [data]);
  const rows = Math.max(data.length, 30);

  useEffect(() => {
    setColumnWidths((prev) => {
      const next = { ...prev };
      cols.forEach((col) => {
        if (!next[col]) next[col] = 140;
      });
      return next;
    });
  }, [cols]);

  // Update formula bar when cell selection changes
  useEffect(() => {
    if (selectedCell && !editingCell) {
      const row = parseInt(selectedCell.slice(1), 10) - 1;
      const cellValue = data[row]?.[selectedCell.slice(0, 1)] || '';
      setFormulaBarValue(cellValue.toString());
    }
  }, [selectedCell, editingCell, data]);

  const calculateFormula = (formula: string): string => {
    const result = parseFormula(formula, data);
    return result.toString();
  };

  const getCellDisplayValue = (col: string, rowIdx: number) => {
    const cellData = data[rowIdx]?.[col];
    if (typeof cellData === 'string' && cellData.startsWith('=')) {
      return calculateFormula(cellData);
    }
    const header = (columnHeaders[cols.indexOf(col)] || col).toLowerCase();
    const numeric = Number(cellData);
    if (cellData !== '' && Number.isFinite(numeric)) {
      if (header.includes('amount') || header.includes('debit') || header.includes('credit') || header.includes('payment')) {
        return `KES ${numeric.toLocaleString()}`;
      }
      if (header.includes('percent') || header.includes('rate')) {
        return `${numeric}%`;
      }
    }
    if (typeof cellData === 'string' && /^\d{4}-\d{2}-\d{2}/.test(cellData)) {
      const parsed = new Date(cellData);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString();
      }
    }
    return cellData ?? '';
  };

  const sortedFilteredData = React.useMemo(() => {
    const filtered = data.filter((row) => cols.every((col) => {
      const query = (filters[col] || '').trim().toLowerCase();
      if (!query) return true;
      return String(row?.[col] ?? '').toLowerCase().includes(query);
    }));

    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      const av = String(a?.[sortColumn] ?? '');
      const bv = String(b?.[sortColumn] ?? '');
      const result = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? result : -result;
    });
  }, [data, cols, filters, sortColumn, sortDirection]);

  const toggleSort = (col: string) => {
    if (sortColumn === col) {
      const nextDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      if (sortDirectionProp === undefined) {
        setSortDirectionInternal(nextDirection);
      }
      onSortChange?.(col, nextDirection);
      return;
    }
    if (sortColumnProp === undefined) {
      setSortColumnInternal(col);
    }
    if (sortDirectionProp === undefined) {
      setSortDirectionInternal('asc');
    }
    onSortChange?.(col, 'asc');
  };

  const handleCellClick = (col: string, rowIdx: number) => {
    onCellSelect(`${col}${rowIdx + 1}`);
  };

  const handleCellDoubleClick = (col: string, rowIdx: number) => {
    const cellRef = `${col}${rowIdx + 1}`;
    onEditStart(cellRef);
    const cellData = data[rowIdx]?.[col] || '';
    setEditingValue(cellData.toString());
  };

  const handleCellEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellEditSave();
    } else if (e.key === 'Escape') {
      onEditEnd();
    }
  };

  const handleCellEditSave = () => {
    if (editingCell) {
      const col = editingCell.slice(0, 1);
      const row = parseInt(editingCell.slice(1)) - 1;
      const newData = [...data];
      if (newData[row]) {
        const ok = onCommitCell?.(editingCell, editingValue);
        if (ok !== undefined && ok !== true) {
          window.alert(ok);
          return;
        }
        (newData[row] as any)[col] = editingValue;
        onDataChange(newData);
      }
    }
    onEditEnd();
  };

  const handleFormulaBarChange = (value: string) => {
    setFormulaBarValue(value);
  };

  const applyFormulaBarValue = () => {
    if (!selectedCell) return;
    const col = selectedCell.slice(0, 1);
    const row = parseInt(selectedCell.slice(1), 10) - 1;
    const newData = [...data];
    if (!newData[row]) newData[row] = {};
    const ok = onCommitCell?.(selectedCell, formulaBarValue);
    if (ok !== undefined && ok !== true) {
      window.alert(ok);
      return;
    }
    (newData[row] as any)[col] = formulaBarValue;
    onDataChange(newData);
    onEditEnd();
  };

  const cancelFormulaEdit = () => {
    const row = parseInt(selectedCell.slice(1), 10) - 1;
    const currentCellValue = data[row]?.[selectedCell.slice(0, 1)] ?? '';
    setFormulaBarValue(String(currentCellValue));
    onEditEnd();
  };

  const handleFormulaBarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      applyFormulaBarValue();
    } else if (e.key === 'Escape') {
      cancelFormulaEdit();
    }
  };

  const handleMouseDownResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizingCol(col);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingCol && gridRef.current) {
        const rect = gridRef.current.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;
        if (newWidth > 30) {
          setColumnWidths((prev) => ({
            ...prev,
            [resizingCol]: newWidth,
          }));
        }
      }
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    if (resizingCol) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingCol]);

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      {/* Formula Bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-300 bg-[#f3f3f3] flex-shrink-0">
        <div className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded bg-white min-w-24 shadow-sm">
          <span className="text-xs font-semibold text-gray-700 font-mono">{selectedCell}</span>
        </div>

        <button
          type="button"
          onClick={cancelFormulaEdit}
          title="Cancel (Esc)"
          className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={applyFormulaBarValue}
          title="Enter (Enter)"
          className="h-7 w-7 inline-flex items-center justify-center rounded border border-gray-300 bg-white text-green-700 hover:bg-green-50"
        >
          <Check className="h-3.5 w-3.5" />
        </button>

        <div className="h-7 px-2 inline-flex items-center justify-center rounded border border-gray-300 bg-white text-gray-700 text-xs font-semibold">
          fx
        </div>

        <input
          type="text"
          value={showFormulas ? formulaBarValue : getCellDisplayValue(selectedCell.slice(0, 1), Math.max(0, parseInt(selectedCell.slice(1), 10) - 1)).toString()}
          onChange={(e) => handleFormulaBarChange(e.target.value)}
          onKeyDown={handleFormulaBarKeyDown}
          onFocus={() => {
            if (!editingCell && selectedCell) {
              onEditStart(selectedCell);
            }
          }}
          onBlur={() => {
            if (editingCell) {
              handleCellEditSave();
            }
          }}
          placeholder="Enter formula or value"
          className="flex-1 px-3 py-1.5 text-sm font-mono border border-gray-300 rounded outline-0 bg-white shadow-sm"
        />
      </div>

      {/* Spreadsheet Grid */}
      <div
        className="flex-1 overflow-auto"
        ref={gridRef}
        style={{
          background: isPageLayoutMode ? '#e5e7eb' : undefined,
        }}
      >
        <div
          className={`inline-block min-w-full ${isPageLayoutMode ? 'py-6' : ''}`}
          style={{
            display: isPageLayoutMode ? 'flex' : 'inline-block',
            justifyContent: isPageLayoutMode ? 'center' : undefined,
          }}
        >
          <div
            style={
              isPageLayoutMode
                ? {
                    width: pageWidth,
                    minHeight: pageMinHeight,
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.18)',
                    border: '1px solid #cbd5e1',
                    position: 'relative',
                    paddingTop: marginTop,
                    paddingBottom: marginBottom,
                    paddingLeft: marginLeft,
                    paddingRight: marginRight,
                  }
                : undefined
            }
          >
            {isPageLayoutMode && (
              <>
                {/* Print margin guides */}
                <div className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-blue-300" style={{ top: marginTop }} />
                <div className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-blue-300" style={{ bottom: marginBottom }} />
                <div className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-blue-300" style={{ left: marginLeft }} />
                <div className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-blue-300" style={{ right: marginRight }} />

                {/* Header/Footer zones */}
                <div className="pointer-events-none absolute left-0 right-0 top-0 h-10 flex items-center justify-center text-[10px] tracking-wide text-slate-400 border-b border-slate-200 bg-slate-50/70">
                  HEADER
                </div>
                <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-10 flex items-center justify-center text-[10px] tracking-wide text-slate-400 border-t border-slate-200 bg-slate-50/70">
                  FOOTER
                </div>
              </>
            )}
          {/* Column Headers */}
          {showHeaders && (
            <div className={`flex z-20 ${freezePanes ? 'sticky top-0' : ''}`}>
              <div className={`w-12 h-6 border-b border-r border-gray-300 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                selectedColRef && selectedRowRef > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
              }`} />
              {cols.map((col) => (
                <div
                  key={col}
                  className={`h-6 border-b border-r border-gray-300 flex items-center justify-between text-xs font-bold relative flex-shrink-0 px-1 ${
                    selectedColRef === col ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}
                  style={{ width: columnWidths[col] }}
                >
                  <button className="truncate text-left" onClick={() => toggleSort(col)} title="Sort column">
                    {columnHeaders[cols.indexOf(col)] || col}
                  </button>
                  <ArrowDownUp className="w-3 h-3 text-gray-500" />
                  <div
                    className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 hover:opacity-100 opacity-0"
                    onMouseDown={(e) => handleMouseDownResize(col, e)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Filter Row */}
          {showFilters && (
            <div className={`flex z-20 bg-white ${freezePanes ? 'sticky' : ''} ${freezePanes ? (showHeaders ? 'top-6' : 'top-0') : ''}`}>
              <div className="w-12 h-6 border-b border-r border-gray-300 bg-gray-50 flex-shrink-0" />
              {cols.map((col) => (
                <div
                  key={`${col}-filter`}
                  className="h-6 border-b border-r border-gray-300 bg-gray-50 px-1 flex items-center flex-shrink-0"
                  style={{ width: columnWidths[col] }}
                >
                  <input
                    value={filters[col] || ''}
                    onChange={(e) => {
                      const next = { ...filters, [col]: e.target.value };
                      if (filtersProp === undefined) {
                        setFiltersInternal(next);
                      }
                      onFiltersChange?.(next);
                    }}
                    placeholder="Filter"
                    className="w-full text-[10px] bg-transparent border-0 outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Rows */}
          {Array.from({ length: Math.max(sortedFilteredData.length, rows) }).map((_, rowIdx) => (
            <div key={rowIdx} className="flex">
              {/* Row Header */}
              <div
                className={`w-12 h-6 ${showGridlines ? 'border-b border-r border-gray-300' : ''} flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  selectedRowRef === rowIdx + 1
                    ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                    : 'bg-gray-100 text-gray-700 hover:border-b-2 hover:border-blue-600'
                } ${freezePanes ? 'sticky left-0 z-10' : ''}`}
                style={{ cursor: downArrowCursor }}
                title={`Row ${rowIdx + 1}`}
              >
                {rowIdx + 1}
              </div>

              {/* Cells */}
              {cols.map((col) => {
                const cellRef = `${col}${rowIdx + 1}`;
                const isSelected = selectedCell === cellRef;
                const isEditing = editingCell === cellRef;
                const isSelectedRow = selectedRowRef === rowIdx + 1;
                const isSelectedCol = selectedColRef === col;
                const cellStyle = cellStyles[cellRef] || {};
                const displayValue = rowIdx < sortedFilteredData.length
                  ? (() => {
                      const cellData = sortedFilteredData[rowIdx]?.[col];
                      if (typeof cellData === 'string' && cellData.startsWith('=')) {
                        return calculateFormula(cellData);
                      }
                      const header = (columnHeaders[cols.indexOf(col)] || col).toLowerCase();
                      const numeric = Number(cellData);
                      if (cellData !== '' && Number.isFinite(numeric)) {
                        if (header.includes('amount') || header.includes('debit') || header.includes('credit') || header.includes('payment')) {
                          return `KES ${numeric.toLocaleString()}`;
                        }
                        if (header.includes('percent') || header.includes('rate')) {
                          return `${numeric}%`;
                        }
                      }
                      if (typeof cellData === 'string' && /^\d{4}-\d{2}-\d{2}/.test(cellData)) {
                        const parsed = new Date(cellData);
                        if (!Number.isNaN(parsed.getTime())) {
                          return parsed.toLocaleDateString();
                        }
                      }
                      return cellData ?? '';
                    })()
                  : '';

                return (
                  <div
                    key={cellRef}
                    onClick={() => handleCellClick(col, rowIdx)}
                    onDoubleClick={() => handleCellDoubleClick(col, rowIdx)}
                    className={`h-6 px-1 text-xs font-mono flex items-center flex-shrink-0 ${
                      isSelected
                        ? `bg-blue-50 border-blue-500 border-b-2 border-r-2 ${showGridlines ? 'border-l border-t' : ''}`
                        : `${(isSelectedRow || isSelectedCol) ? 'bg-blue-50/40' : 'bg-white'} hover:bg-gray-50 ${showGridlines ? 'border-b border-r border-gray-300' : ''}`
                    }`}
                    style={{ width: columnWidths[col], cursor: 'crosshair' }}
                    tabIndex={0}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={handleCellEditKeyDown}
                        onBlur={handleCellEditSave}
                        autoFocus
                        className="w-full h-full border-0 outline-0 px-1 text-xs font-mono bg-white"
                        style={cellStyle}
                      />
                    ) : (
                      <span className="truncate" style={cellStyle}>{displayValue}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          </div>
        </div>
      </div>

      {canLoadMoreRows && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex justify-center">
          <button
            type="button"
            onClick={onLoadMoreRows}
            disabled={isLoadingMoreRows}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-60"
          >
            {isLoadingMoreRows ? 'Loading more...' : 'Load more rows'}
          </button>
        </div>
      )}
    </div>
  );
};
