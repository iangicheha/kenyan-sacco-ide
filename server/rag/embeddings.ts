const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
const EMBEDDING_DIM_LOCAL = 256;

const cache = new Map<string, number[]>();

function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const n = Math.sqrt(sum) || 1;
  return vec.map((v) => v / n);
}

/** Deterministic local embedding for offline/tests — not for production accuracy vs OpenAI. */
export function embedTextLocal(text: string): number[] {
  const vec = new Array(EMBEDDING_DIM_LOCAL).fill(0);
  const s = text.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const idx = (c * (i + 17)) % EMBEDDING_DIM_LOCAL;
    vec[idx] += Math.sin(c * 0.01 + i * 0.001);
  }
  const words = s.split(/\W+/).filter(Boolean);
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    for (let j = 0; j < word.length; j++) {
      const idx = (word.charCodeAt(j) * (w + 3) + j * 11) % EMBEDDING_DIM_LOCAL;
      vec[idx] += 1;
    }
  }
  return l2Normalize(vec);
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.AI_MODEL_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key missing");
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embeddings request failed: ${response.status} ${err}`);
  }
  const body = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };
  const sorted = [...body.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

export function useOpenAiEmbeddings(): boolean {
  const key = process.env.AI_MODEL_KEY ?? process.env.OPENAI_API_KEY;
  return Boolean(key && process.env.RAG_USE_LOCAL_EMBEDDINGS !== "true");
}

/**
 * Embed a batch of strings. Uses OpenAI when configured, otherwise local deterministic vectors.
 * Results are cached (by exact string) for repeated indexing.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const useOpenAI = useOpenAiEmbeddings();
  const out: number[][] = new Array(texts.length);
  const pending: { index: number; text: string }[] = [];
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    const hit = cache.get(t);
    if (hit) {
      out[i] = hit;
    } else {
      pending.push({ index: i, text: t });
    }
  }
  if (pending.length === 0) return out;

  if (useOpenAI) {
    const embeddings = await embedOpenAI(pending.map((p) => p.text));
    pending.forEach((p, j) => {
      const emb = embeddings[j];
      cache.set(p.text, emb);
      out[p.index] = emb;
    });
  } else {
    for (const p of pending) {
      const emb = embedTextLocal(p.text);
      cache.set(p.text, emb);
      out[p.index] = emb;
    }
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}

/** Test helper: clear embedding cache */
export function clearEmbeddingCache(): void {
  cache.clear();
}
