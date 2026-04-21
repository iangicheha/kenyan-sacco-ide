/**
 * Local-First Document Indexer
 * 
 * In a native IDE, this would index local files. 
 * For now, it provides the structure for RAG-based financial context.
 */

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: {
    pageNumber?: number;
    section?: string;
    regulationReference?: string;
  };
  embedding?: number[];
}

export class DocumentIndexer {
  private chunks: DocumentChunk[] = [];

  /**
   * Simulates indexing a local financial document.
   */
  async indexDocument(documentId: string, content: string, metadata: any = {}): Promise<void> {
    // In a real IDE, this would use a local embedding model (e.g., via Ollama or Transformers.js)
    // and store in a local vector DB (e.g., LanceDB or DuckDB).
    const chunk: DocumentChunk = {
      id: Math.random().toString(36).substring(7),
      documentId,
      content,
      metadata
    };
    this.chunks.push(chunk);
    console.log(`Indexed document: ${documentId}, chunks: ${this.chunks.length}`);
  }

  /**
   * Searches for relevant context for a financial query.
   */
  async searchContext(query: string, limit: number = 3): Promise<DocumentChunk[]> {
    // Simple keyword search for the prototype
    const lowerQuery = query.toLowerCase();
    return this.chunks
      .filter(chunk => chunk.content.toLowerCase().includes(lowerQuery))
      .slice(0, limit);
  }

  /**
   * Formats retrieved chunks for LLM context.
   */
  formatContextForPrompt(chunks: DocumentChunk[]): string {
    if (chunks.length === 0) return "No relevant local context found.";
    
    return chunks.map(c => (
      `[Source: ${c.documentId}${c.metadata.section ? `, Section: ${c.metadata.section}` : ""}]
      ${c.content}`
    )).join("\n\n");
  }
}

export const globalIndexer = new DocumentIndexer();
