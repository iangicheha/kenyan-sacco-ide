import { filterRetrievedContextToSchema } from "../ai/validator";
import { retrieveForQuery } from "../rag/retriever";
import type { DataAgentOutput, RetrievedContext } from "../types";
import { TtlCache } from "./cache";

const ragCache = new TtlCache<RetrievedContext>();

function cacheKey(query: string, tableNameHint?: string): string {
  return `${query.trim().toLowerCase()}::${tableNameHint ?? ""}`;
}

/** Aggregate confidence from retrieval scores (0–1). */
function confidenceFromContext(ctx: RetrievedContext): number {
  const scores: number[] = [];
  for (const t of ctx.relevantTables) scores.push(t.score);
  for (const c of ctx.relevantColumns) scores.push(c.score);
  for (const d of ctx.relevantDocs) scores.push(d.score);
  if (scores.length === 0) return 0;
  const top = scores.slice().sort((a, b) => b - a).slice(0, 5);
  const avg = top.reduce((a, b) => a + b, 0) / top.length;
  return Math.min(1, Math.max(0, avg));
}

export interface DataAgentOptions {
  tableNameHint?: string;
  topK?: number;
  /** Skip cache (tests). */
  skipCache?: boolean;
}

/**
 * Retrieves RAG context only — no aggregates, forecasts, or financial results.
 */
export async function getContext(query: string, options?: DataAgentOptions): Promise<DataAgentOutput> {
  const started = Date.now();
  const key = cacheKey(query, options?.tableNameHint);
  if (!options?.skipCache) {
    const hit = ragCache.get(key);
    if (hit) {
      const filtered = filterRetrievedContextToSchema(hit);
      return {
        relevantTables: filtered.relevantTables,
        relevantColumns: filtered.relevantColumns,
        relevantDocs: filtered.relevantDocs,
        selectedChunks: filtered.selectedChunks,
        confidence: confidenceFromContext(filtered),
        latencyMs: Date.now() - started,
        cacheHit: true,
      };
    }
  }

  let raw: RetrievedContext = {
    relevantTables: [],
    relevantColumns: [],
    relevantDocs: [],
    selectedChunks: [],
  };
  try {
    raw = await retrieveForQuery(query, {
      tableNameHint: options?.tableNameHint,
      topK: options?.topK,
    });
  } catch {
    raw = { relevantTables: [], relevantColumns: [], relevantDocs: [], selectedChunks: [] };
  }

  if (!options?.skipCache) {
    ragCache.set(key, raw);
  }

  const filtered = filterRetrievedContextToSchema(raw);
  return {
    relevantTables: filtered.relevantTables,
    relevantColumns: filtered.relevantColumns,
    relevantDocs: filtered.relevantDocs,
    selectedChunks: filtered.selectedChunks,
    confidence: confidenceFromContext(filtered),
    latencyMs: Date.now() - started,
    cacheHit: false,
  };
}

export function _clearDataAgentCacheForTests(): void {
  ragCache.clear();
}
