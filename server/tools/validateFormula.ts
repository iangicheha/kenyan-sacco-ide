import type { FormulaValidationResult } from "../types.js";

/**
 * Deterministic validation gate:
 * keep invalid formulas out of the approval queue.
 */
export function validateFormula(formula: string): FormulaValidationResult {
  if (!formula || typeof formula !== "string") {
    return { isValid: false, errorMessage: "Formula is required." };
  }

  const trimmed = formula.trim();
  if (!trimmed.startsWith("=")) {
    return { isValid: false, errorMessage: "Formula must start with '='." };
  }

  // Basic parenthesis balance check for early rejection.
  let balance = 0;
  for (const ch of trimmed) {
    if (ch === "(") balance += 1;
    if (ch === ")") balance -= 1;
    if (balance < 0) {
      return { isValid: false, errorMessage: "Unbalanced parentheses in formula." };
    }
  }
  if (balance !== 0) {
    return { isValid: false, errorMessage: "Unbalanced parentheses in formula." };
  }

  return { isValid: true };
}
