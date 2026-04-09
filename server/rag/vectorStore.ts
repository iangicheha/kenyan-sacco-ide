export interface VectorDocument {
  id: string;
  embedding: number[];
  text: string;
  metadata: Record<string, unknown>;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export class InMemoryVectorStore {
  private docs: VectorDocument[] = [];

  addDocument(doc: VectorDocument): void {
    const idx = this.docs.findIndex((d) => d.id === doc.id);
    if (idx >= 0) this.docs[idx] = doc;
    else this.docs.push(doc);
  }

  removeWhere(predicate: (meta: Record<string, unknown>) => boolean): void {
    this.docs = this.docs.filter((d) => !predicate(d.metadata));
  }

  clear(): void {
    this.docs = [];
  }

  get size(): number {
    return this.docs.length;
  }

  /**
   * Cosine similarity search; returns scores in [0, 1] for comparable direction.
   */
  similaritySearch(queryEmbedding: number[], topK: number): Array<{ score: number; doc: VectorDocument }> {
    const ranked = this.docs.map((doc) => ({
      score: cosineSimilarity(queryEmbedding, doc.embedding),
      doc,
    }));
    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, topK);
  }
}
