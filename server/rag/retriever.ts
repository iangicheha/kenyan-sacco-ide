import type { ColumnType, RetrievedContext, RetrievedColumnRef, RetrievedDocRef, RetrievedTableRef, RowRecord } from "../types";
import { getCurrentSchemaVersion, getTable, listSchemas } from "../data/tableStore";
import { embedQuery, embedTexts } from "./embeddings";
import { InMemoryVectorStore, type VectorDocument } from "./vectorStore";

const store = new InMemoryVectorStore();
let lastTablesFingerprint = "";

const SAMPLE_ROWS = 3;
const DEFAULT_TOP_K = 24;
const MAX_TABLES = 6;
const MAX_COLUMNS = 12;
const MAX_DOCS = 5;

function tablesFingerprint(): string {
  const schemas = listSchemas();
  return schemas
    .map((s) => {
      const v = getCurrentSchemaVersion(s.tableName);
      return `${s.tableName}@${v ?? 0}`;
    })
    .sort()
    .join("|");
}

function tableChunkPayload(tableName: string): {
  text: string;
  payload: {
    kind: "table";
    name: string;
    schemaVersion: number;
    columns: string[];
    sample: RowRecord[];
  };
} {
  const table = getTable(tableName);
  if (!table) {
    return {
      text: JSON.stringify({ type: "table", name: tableName, columns: [], sample: [] }),
      payload: { kind: "table", name: tableName, schemaVersion: 0, columns: [], sample: [] },
    };
  }
  const sample = table.rows.slice(0, SAMPLE_ROWS);
  const columns = table.schema.columns.map((c) => c.name);
  const obj = {
    type: "table" as const,
    name: table.name,
    schemaVersion: table.version,
    columns,
    sample,
  };
  return { text: JSON.stringify(obj), payload: { kind: "table", name: table.name, schemaVersion: table.version, columns, sample } };
}

function columnChunkPayload(tableName: string, column: string, colType: ColumnType): { text: string; payload: Record<string, unknown> } {
  const obj = {
    type: "column" as const,
    tableName,
    column,
    columnType: colType,
  };
  return { text: JSON.stringify(obj), payload: { kind: "column", tableName, column, columnType: colType } };
}

/**
 * Re-index table/column vectors from the current table store. Preserves document-* chunks.
 */
export async function syncTableIndexFromStore(): Promise<void> {
  const fp = tablesFingerprint();
  if (fp === lastTablesFingerprint && store.size > 0) return;

  store.removeWhere((m) => m.kind === "table" || m.kind === "column");
  const schemas = listSchemas();
  const texts: string[] = [];
  const metas: Array<Record<string, unknown>> = [];
  const ids: string[] = [];

  for (const schema of schemas) {
    const tname = schema.tableName;
    const { text, payload } = tableChunkPayload(tname);
    const id = `table:${tname}`;
    ids.push(id);
    texts.push(text);
    metas.push({ ...payload, id, kind: "table" as const });

    for (const col of schema.columns) {
      const { text: ctext, payload: cmeta } = columnChunkPayload(tname, col.name, col.type);
      const cid = `column:${tname}:${col.name}`;
      ids.push(cid);
      texts.push(ctext);
      metas.push({ ...cmeta, id: cid, kind: "column" as const });
    }
  }

  if (texts.length === 0) {
    lastTablesFingerprint = fp;
    return;
  }

  const embeddings = await embedTexts(texts);
  embeddings.forEach((emb, i) => {
    store.addDocument({
      id: ids[i],
      embedding: emb,
      text: texts[i],
      metadata: metas[i],
    });
  });
  lastTablesFingerprint = fp;
}

/** Add a precomputed embedding (e.g. tests or external indexer). */
export function addDocument(doc: VectorDocument): void {
  store.addDocument(doc);
}

export async function addDocumentAsync(doc: Omit<VectorDocument, "embedding">): Promise<void> {
  const [embedding] = await embedTexts([doc.text]);
  store.addDocument({ ...doc, embedding });
}

/** Register a financial policy/report chunk (context only). */
export async function addFinancialDocument(id: string, title: string, body: string): Promise<void> {
  const text = JSON.stringify({
    type: "document",
    id,
    title,
    body: body.slice(0, 8000),
  });
  await addDocumentAsync({
    id: `document:${id}`,
    text,
    metadata: { kind: "document", docId: id, title },
  });
}

function boostTableNameHint(
  hits: Array<{ score: number; doc: VectorDocument }>,
  tableNameHint?: string
): Array<{ score: number; doc: VectorDocument }> {
  if (!tableNameHint) return hits;
  return hits.map((h) => {
    const meta = h.doc.metadata;
    const name = String(meta.name ?? meta.tableName ?? "");
    if (name === tableNameHint || h.doc.id.includes(tableNameHint)) {
      return { score: h.score + 0.05, doc: h.doc };
    }
    return h;
  });
}

function buildStructuredContext(
  hits: Array<{ score: number; doc: VectorDocument }>,
  tableNameHint?: string
): RetrievedContext {
  const sorted = [...hits].sort((a, b) => b.score - a.score);
  const tableMap = new Map<string, RetrievedTableRef>();
  const colList: RetrievedColumnRef[] = [];
  const docs: RetrievedDocRef[] = [];
  const selectedChunks: NonNullable<RetrievedContext["selectedChunks"]> = [];

  for (const { score, doc } of sorted) {
    const kind = doc.metadata.kind as string;
    selectedChunks.push({
      id: doc.id,
      kind: kind === "document" ? "document" : kind === "column" ? "column" : "table",
      score,
      text: doc.text.slice(0, 2000),
    });
  }

  for (const { score, doc } of sorted) {
    const kind = doc.metadata.kind as string;
    if (kind === "table") {
      const name = String(doc.metadata.name);
      const prev = tableMap.get(name);
      const ref: RetrievedTableRef = {
        name,
        schemaVersion: doc.metadata.schemaVersion as number | undefined,
        score: prev ? Math.max(prev.score, score) : score,
        columns: (doc.metadata.columns as string[]) ?? [],
        sample: doc.metadata.sample as RowRecord[] | undefined,
      };
      tableMap.set(name, ref);
    } else if (kind === "column") {
      colList.push({
        tableName: String(doc.metadata.tableName),
        column: String(doc.metadata.column),
        type: doc.metadata.columnType as ColumnType | undefined,
        score,
      });
    } else if (kind === "document") {
      docs.push({
        id: String(doc.metadata.docId ?? doc.id.replace(/^document:/, "")),
        title: doc.metadata.title as string | undefined,
        excerpt: doc.text.slice(0, 500),
        score,
      });
    }
  }

  let relevantTables = Array.from(tableMap.values()).sort((a, b) => b.score - a.score).slice(0, MAX_TABLES);
  const relevantColumns = colList.sort((a, b) => b.score - a.score).slice(0, MAX_COLUMNS);
  let relevantDocs = docs.sort((a, b) => b.score - a.score).slice(0, MAX_DOCS);

  if (tableNameHint) {
    relevantTables = relevantTables.map((t) =>
      t.name === tableNameHint ? { ...t, score: t.score + 1e-6 } : t
    );
    relevantTables.sort((a, b) => b.score - a.score);
  }

  return {
    relevantTables,
    relevantColumns,
    relevantDocs,
    selectedChunks: selectedChunks.slice(0, 32),
  };
}

/**
 * Retrieve planning context: relevant tables, columns, and uploaded policy docs.
 * Does not compute aggregates or forecasts — retrieval only.
 */
export async function retrieveForQuery(
  query: string,
  options?: { tableNameHint?: string; topK?: number }
): Promise<RetrievedContext> {
  await syncTableIndexFromStore();
  if (!query.trim()) {
    return { relevantTables: [], relevantColumns: [], relevantDocs: [], selectedChunks: [] };
  }
  const topK = options?.topK ?? DEFAULT_TOP_K;
  const qEmb = await embedQuery(query);
  let hits = store.similaritySearch(qEmb, topK);
  hits = boostTableNameHint(hits, options?.tableNameHint);
  hits.sort((a, b) => b.score - a.score);
  return buildStructuredContext(hits, options?.tableNameHint);
}

/** Test helpers */
export function _resetRagForTests(): void {
  store.clear();
  lastTablesFingerprint = "";
}
