import { useState, useRef, useEffect } from "react";

interface GridCell {
  id: string;
  value: string;
  formula?: string;
  aiGenerated?: boolean;
  error?: boolean;
  source?: string;
}

interface SpreadsheetGridProps {
  rows?: number;
  cols?: number;
  onCellChange?: (row: number, col: number, value: string) => void;
  onCellSelect?: (row: number, col: number) => void;
}

export function SpreadsheetGrid({
  rows = 50,
  cols = 10,
  onCellChange,
  onCellSelect,
}: SpreadsheetGridProps) {
  const [data, setData] = useState<GridCell[][]>(
    Array(rows)
      .fill(null)
      .map((_, r) =>
        Array(cols)
          .fill(null)
          .map((_, c) => ({
            id: `${r}-${c}`,
            value: r === 0 ? String.fromCharCode(65 + c) : "",
          }))
      )
  );

  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cellWidth = 120;
  const cellHeight = 32;
  const rowHeaderWidth = 40;

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col });
    onCellSelect?.(row, col);
  };

  const handleCellDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col });
  };

  const handleCellChange = (value: string) => {
    if (!editingCell) return;

    const newData = data.map((r) => [...r]);
    newData[editingCell.row][editingCell.col].value = value;
    setData(newData);
    onCellChange?.(editingCell.row, editingCell.col, value);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: number
  ) => {
    if (e.key === "Enter") {
      setEditingCell(null);
      if (row + 1 < rows) {
        setSelectedCell({ row: row + 1, col });
      }
    } else if (e.key === "Escape") {
      setEditingCell(null);
    } else if (e.key === "Tab") {
      e.preventDefault();
      setEditingCell(null);
      if (col + 1 < cols) {
        setSelectedCell({ row, col: col + 1 });
      }
    }
  };

  const getColumnLabel = (col: number): string => {
    let label = "";
    let n = col;
    while (n >= 0) {
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26) - 1;
    }
    return label;
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Formula Bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
        <span className="text-xs font-medium text-muted-foreground min-w-12">
          {selectedCell
            ? `${getColumnLabel(selectedCell.col)}${selectedCell.row}`
            : ""}
        </span>
        <input
          type="text"
          placeholder="Enter formula or value..."
          value={
            selectedCell
              ? data[selectedCell.row][selectedCell.col].formula ||
                data[selectedCell.row][selectedCell.col].value
              : ""
          }
          onChange={(e) => {
            if (selectedCell) {
              const newData = data.map((r) => [...r]);
              newData[selectedCell.row][selectedCell.col].value = e.target.value;
              setData(newData);
            }
          }}
          className="flex-1 px-3 py-1 text-sm bg-input border border-border rounded text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Grid Container */}
      <div
        ref={gridRef}
        className="flex-1 overflow-auto bg-background"
        style={{ scrollBehavior: "smooth" }}
      >
        <div className="inline-block min-w-full">
          {/* Column Headers */}
          <div className="flex sticky top-0 z-10 bg-sidebar border-b border-border">
            <div
              className="flex items-center justify-center bg-card border-r border-border font-medium text-xs text-muted-foreground"
              style={{ width: rowHeaderWidth, height: cellHeight }}
            />
            {Array(cols)
              .fill(null)
              .map((_, col) => (
                <div
                  key={`header-${col}`}
                  className="flex items-center justify-center bg-card border-r border-border font-medium text-xs text-foreground"
                  style={{ width: cellWidth, height: cellHeight }}
                >
                  {getColumnLabel(col)}
                </div>
              ))}
          </div>

          {/* Rows */}
          {Array(rows)
            .fill(null)
            .map((_, row) => (
              <div key={`row-${row}`} className="flex border-b border-border">
                {/* Row Header */}
                <div
                  className="flex items-center justify-center bg-card border-r border-border font-medium text-xs text-muted-foreground"
                  style={{ width: rowHeaderWidth, height: cellHeight }}
                >
                  {row}
                </div>

                {/* Cells */}
                {Array(cols)
                  .fill(null)
                  .map((_, col) => {
                    const cell = data[row][col];
                    const isSelected =
                      selectedCell?.row === row && selectedCell?.col === col;
                    const isEditing =
                      editingCell?.row === row && editingCell?.col === col;

                    return (
                      <div
                        key={`cell-${row}-${col}`}
                        className={`grid-cell ${isSelected ? "selected" : ""} ${
                          cell.aiGenerated ? "ai-generated" : ""
                        } ${cell.error ? "error" : ""}`}
                        style={{ width: cellWidth, height: cellHeight }}
                        onClick={() => handleCellClick(row, col)}
                        onDoubleClick={() => handleCellDoubleClick(row, col)}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="text"
                            value={cell.value}
                            onChange={(e) => handleCellChange(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, row, col)}
                            onBlur={() => setEditingCell(null)}
                            className="w-full h-full px-2 text-xs bg-input border-0 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        ) : (
                          <span
                            className="text-xs truncate px-2"
                            title={cell.value}
                          >
                            {cell.value}
                          </span>
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
}
