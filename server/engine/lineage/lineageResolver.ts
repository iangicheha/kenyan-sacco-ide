import { globalIndexer, type DocumentChunk } from "../indexing/documentIndexer.js";

export interface CellLineage {
  cellRef: string;
  formula: string;
  regulationReference: string;
  evidenceText: string;
  sourceDocument: string;
  confidence: number;
  timestamp: string;
}

/**
 * Lineage Resolver
 * 
 * This service connects a spreadsheet cell's logic to the literal text
 * of the regulation that governs it.
 */
export class LineageResolver {
  /**
   * Resolves the literal evidence text for a given regulation reference.
   */
  async resolveEvidence(regulationRef: string): Promise<{ text: string; source: string }> {
    // Search the indexer for the specific regulation reference
    const chunks = await globalIndexer.searchContext(regulationRef, 1);
    
    if (chunks.length > 0) {
      return {
        text: chunks[0].content,
        source: chunks[0].documentId
      };
    }

    return {
      text: "Literal text not found in indexed documents. Please ensure regulatory handbooks are uploaded.",
      source: "Unknown"
    };
  }

  /**
   * Builds a full lineage object for a cell.
   */
  async buildCellLineage(input: {
    cellRef: string;
    formula: string;
    regulationReference: string;
    confidence: number;
  }): Promise<CellLineage> {
    const evidence = await this.resolveEvidence(input.regulationReference);

    return {
      cellRef: input.cellRef,
      formula: input.formula,
      regulationReference: input.regulationReference,
      evidenceText: evidence.text,
      sourceDocument: evidence.source,
      confidence: input.confidence,
      timestamp: new Date().toISOString()
    };
  }
}

export const globalLineageResolver = new LineageResolver();
