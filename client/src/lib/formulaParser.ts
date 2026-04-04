import { evaluate } from 'mathjs';

/**
 * Parse and evaluate Excel-like formulas
 * Supports cell references (A1, B2, etc.) and mathematical expressions
 */
export const parseFormula = (formula: string, data: any[]): string | number => {
  try {
    // Remove the leading '=' if present
    let expr = formula.startsWith('=') ? formula.slice(1) : formula;

    // Replace cell references with their values
    // Matches patterns like A1, B2, Z99, etc.
    expr = expr.replace(/([A-Z])(\d+)/g, (match) => {
      const col = match.charCodeAt(0) - 65; // Convert A=0, B=1, etc.
      const row = parseInt(match.slice(1)) - 1; // Convert to 0-based index
      
      // Get the value from the data array
      const colLetter = String.fromCharCode(65 + col);
      const value = data[row]?.[colLetter];
      
      // If the value is a formula, recursively evaluate it
      if (typeof value === 'string' && value.startsWith('=')) {
        return parseFormula(value, data).toString();
      }
      
      // Return the value or 0 if not found
      return (value ?? 0).toString();
    });

    // Handle common Excel functions
    expr = expr.toUpperCase();
    
    // SUM function: SUM(A1:A5) or SUM(A1,A2,A3)
    expr = expr.replace(/SUM\(([^)]+)\)/g, (match, args) => {
      const values = parseRangeOrList(args, data);
      return values.reduce((a: number, b: number) => a + b, 0).toString();
    });

    // AVERAGE function
    expr = expr.replace(/AVERAGE\(([^)]+)\)/g, (match, args) => {
      const values = parseRangeOrList(args, data);
      const sum = values.reduce((a: number, b: number) => a + b, 0);
      return (sum / values.length).toString();
    });

    // COUNT function
    expr = expr.replace(/COUNT\(([^)]+)\)/g, (match, args) => {
      const values = parseRangeOrList(args, data);
      return values.length.toString();
    });

    // MAX function
    expr = expr.replace(/MAX\(([^)]+)\)/g, (match, args) => {
      const values = parseRangeOrList(args, data);
      return Math.max(...values).toString();
    });

    // MIN function
    expr = expr.replace(/MIN\(([^)]+)\)/g, (match, args) => {
      const values = parseRangeOrList(args, data);
      return Math.min(...values).toString();
    });

    // Convert back to lowercase for mathjs evaluation
    expr = expr.toLowerCase();

    // Evaluate the expression using mathjs
    const result = evaluate(expr);

    // Format the result
    if (typeof result === 'number') {
      // Return integer if it's a whole number, otherwise return with 2 decimal places
      return Number.isInteger(result) ? result : parseFloat(result.toFixed(2));
    }

    return result.toString();
  } catch (error) {
    console.error('Formula evaluation error:', error, 'Formula:', formula);
    return '#ERROR';
  }
};

/**
 * Parse a range (A1:A5) or list (A1,A2,A3) of cell references
 */
const parseRangeOrList = (args: string, data: any[]): number[] => {
  const values: number[] = [];

  // Split by comma for multiple arguments
  const parts = args.split(',').map((p) => p.trim());

  for (const part of parts) {
    if (part.includes(':')) {
      // Handle range like A1:A5
      const [start, end] = part.split(':').map((p) => p.trim());
      const startCol = start.charCodeAt(0) - 65;
      const startRow = parseInt(start.slice(1)) - 1;
      const endCol = end.charCodeAt(0) - 65;
      const endRow = parseInt(end.slice(1)) - 1;

      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const colLetter = String.fromCharCode(65 + col);
          const value = data[row]?.[colLetter];
          if (typeof value === 'number') {
            values.push(value);
          } else if (typeof value === 'string' && value.startsWith('=')) {
            const result = parseFormula(value, data);
            if (typeof result === 'number') {
              values.push(result);
            }
          }
        }
      }
    } else {
      // Handle single cell reference like A1
      const col = part.charCodeAt(0) - 65;
      const row = parseInt(part.slice(1)) - 1;
      const colLetter = String.fromCharCode(65 + col);
      const value = data[row]?.[colLetter];
      if (typeof value === 'number') {
        values.push(value);
      } else if (typeof value === 'string' && value.startsWith('=')) {
        const result = parseFormula(value, data);
        if (typeof result === 'number') {
          values.push(result);
        }
      }
    }
  }

  return values;
};
