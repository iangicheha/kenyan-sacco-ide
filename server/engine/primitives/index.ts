/**
 * Financial Primitive Library
 * 
 * This module defines "Audited Logic Blocks" for Kenyan SACCOs.
 * Instead of the AI writing raw formulas, it uses these primitives
 * which are then expanded into deterministic, compliant formulas.
 */

export interface PrimitiveDefinition {
  id: string;
  name: string;
  description: string;
  regulationReference: string;
  parameters: Array<{
    name: string;
    type: "range" | "number" | "string";
    description: string;
  }>;
  formulaTemplate: (args: Record<string, string | number>) => string;
}

export const SACCO_PRIMITIVES: Record<string, PrimitiveDefinition> = {
  /**
   * SASRA Loan Provisioning
   * Calculates provisioning based on loan classification and days in arrears.
   */
  CALC_PROVISION: {
    id: "CALC_PROVISION",
    name: "Loan Provisioning",
    description: "Calculates the required provision amount based on SASRA guidelines.",
    regulationReference: "SASRA/REG/2010 Section 41",
    parameters: [
      { name: "loanAmount", type: "range", description: "Range containing loan balances" },
      { name: "daysInArrears", type: "range", description: "Range containing days in arrears" },
      { name: "classification", type: "string", description: "Loan category (Performing, Watch, Substandard, Doubtful, Loss)" }
    ],
    formulaTemplate: (args) => {
      const rates: Record<string, number> = {
        "performing": 0.01,
        "watch": 0.05,
        "substandard": 0.25,
        "doubtful": 0.50,
        "loss": 1.00
      };
      const rate = rates[String(args.classification).toLowerCase()] || 0.01;
      return `=${args.loanAmount} * ${rate}`;
    }
  },

  /**
   * Institutional Capital Ratio
   * Core stability metric for Kenyan SACCOs.
   */
  INSTITUTIONAL_CAPITAL_RATIO: {
    id: "INSTITUTIONAL_CAPITAL_RATIO",
    name: "Institutional Capital Ratio",
    description: "Calculates the ratio of institutional capital to total assets.",
    regulationReference: "SASRA/REG/2010 Section 36",
    parameters: [
      { name: "instCapital", type: "range", description: "Cell containing institutional capital" },
      { name: "totalAssets", type: "range", description: "Cell containing total assets" }
    ],
    formulaTemplate: (args) => {
      return `=${args.instCapital} / ${args.totalAssets}`;
    }
  },

  /**
   * Liquidity Ratio
   * Ensures SACCO has enough cash to meet short-term obligations.
   */
  LIQUIDITY_RATIO: {
    id: "LIQUIDITY_RATIO",
    name: "Liquidity Ratio",
    description: "Calculates liquid assets as a percentage of savings deposits and short-term liabilities.",
    regulationReference: "SASRA/REG/2010 Section 45",
    parameters: [
      { name: "liquidAssets", type: "range", description: "Cell containing liquid assets" },
      { name: "shortTermLiabilities", type: "range", description: "Cell containing short-term liabilities" }
    ],
    formulaTemplate: (args) => {
      return `=${args.liquidAssets} / ${args.shortTermLiabilities}`;
    }
  }
};

/**
 * Expands a primitive call into a native spreadsheet formula.
 */
export function expandPrimitive(primitiveId: string, args: Record<string, string | number>): string {
  const primitive = SACCO_PRIMITIVES[primitiveId];
  if (!primitive) {
    throw new Error(`Unknown primitive: ${primitiveId}`);
  }
  return primitive.formulaTemplate(args);
}
