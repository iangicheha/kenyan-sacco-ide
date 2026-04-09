import { describe, it, expect } from "vitest";
import { InMemoryVectorStore } from "./vectorStore";

describe("InMemoryVectorStore", () => {
  it("supports addDocument and similaritySearch", () => {
    const store = new InMemoryVectorStore();
    const q = [1, 0, 0];
    store.addDocument({
      id: "a",
      embedding: [1, 0, 0],
      text: "alpha",
      metadata: { kind: "table" },
    });
    store.addDocument({
      id: "b",
      embedding: [0, 1, 0],
      text: "beta",
      metadata: { kind: "table" },
    });
    const hits = store.similaritySearch(q, 2);
    expect(hits[0].doc.id).toBe("a");
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });
});
