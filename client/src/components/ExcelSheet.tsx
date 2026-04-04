import React, { useState, useRef, useEffect } from 'react';
import { parseFormula } from '@/lib/formulaParser';
import { ChevronDown } from 'lucide-react';

interface ExcelSheetProps {
  data: any[];
  onDataChange: (newData: any[]) => void;
  selectedCell: string;
  onCellSelect: (cell: string) => void;
  editingCell: string | null;
  onEditStart: (cell: string) => void;
  onEditEnd: () => void;
}

export const ExcelSheet: React.FC<ExcelSheetProps> = ({
  data,
  onDataChange,
  selectedCell,
  onCellSelect,
  editingCell,
  onEditStart,
  onEditEnd,
}) => {
  const [editingValue, setEditingValue] = useState('');
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    A: 100, B: 100, C: 100, D: 100, E: 100, F: 100, G: 100, H: 100, I: 100, J: 100,
  });
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const rows = 100;

  // Update formula bar when cell selection changes
  useEffect(() => {
    if (selectedCell && !editingCell) {
      const col = selectedCell.charCodeAt(0) - 65;
      const row = parseInt(selectedCell.slice(1)) - 1;
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
    return cellData ?? '';
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
        (newData[row] as any)[col] = editingValue;
        onDataChange(newData);
      }
    }
    onEditEnd();
  };

  const handleFormulaBarChange = (value: string) => {
    setFormulaBarValue(value);
  };

  const handleFormulaBarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingCell) {
        const col = editingCell.slice(0, 1);
        const row = parseInt(editingCell.slice(1)) - 1;
        const newData = [...data];
        if (newData[row]) {
          (newData[row] as any)[col] = formulaBarValue;
          onDataChange(newData);
        }
      }
      onEditEnd();
    } else if (e.key === 'Escape') {
      onEditEnd();
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
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-300 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded bg-white min-w-24">
          <span className="text-xs font-semibold text-gray-700">{selectedCell}</span>
        </div>
        <div className="text-gray-400">|</div>
        <input
          type="text"
          value={formulaBarValue}
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
          className="flex-1 px-3 py-1 text-sm font-mono border-0 outline-0 bg-white"
        />
      </div>

      {/* Spreadsheet Grid */}
      <div className="flex-1 overflow-auto" ref={gridRef}>
        <div className="inline-block min-w-full">
          {/* Column Headers */}
          <div className="flex sticky top-0 z-20">
            <div className="w-12 h-6 border-b border-r border-gray-300 bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700 flex-shrink-0" />
            {cols.map((col) => (
              <div
                key={col}
                className="h-6 border-b border-r border-gray-300 bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700 relative flex-shrink-0"
                style={{ width: columnWidths[col] }}
              >
                {col}
                <div
                  className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 hover:opacity-100 opacity-0"
                  onMouseDown={(e) => handleMouseDownResize(col, e)}
                />
              </div>
            ))}
          </div>

          {/* Rows */}
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <div key={rowIdx} className="flex">
              {/* Row Header */}
              <div className="w-12 h-6 border-b border-r border-gray-300 bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700 flex-shrink-0 sticky left-0 z-10">
                {rowIdx + 1}
              </div>

              {/* Cells */}
              {cols.map((col) => {
                const cellRef = `${col}${rowIdx + 1}`;
                const isSelected = selectedCell === cellRef;
                const isEditing = editingCell === cellRef;
                const displayValue = getCellDisplayValue(col, rowIdx);

                return (
                  <div
                    key={cellRef}
                    onClick={() => handleCellClick(col, rowIdx)}
                    onDoubleClick={() => handleCellDoubleClick(col, rowIdx)}
                    className={`h-6 border-b border-r border-gray-300 px-1 text-xs font-mono flex items-center flex-shrink-0 ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 border-b-2 border-r-2'
                        : 'bg-white hover:bg-gray-50'
                    }`}
                    style={{ width: columnWidths[col] }}
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
                      />
                    ) : (
                      <span className="truncate">{displayValue}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
