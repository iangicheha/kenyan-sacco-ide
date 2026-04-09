import { describe, it, expect } from "vitest";
import { interpretIntent } from "./interpreter";

describe("interpreter", () => {
  it("uses deterministic heuristic without API key", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const intent = await interpretIntent("forecast revenue next 3 months");
    process.env.OPENAI_API_KEY = prev;
    expect(intent.intent).toBe("forecast");
    expect(intent.targetColumn).toBe("revenue");
  });

  it("uses RAG column hints when keywords do not match", async () => {
    const prevKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const intent = await interpretIntent("forecast the next quarter trend", {
      retrievedContext: {
        relevantTables: [],
        relevantColumns: [
          { tableName: "demo::Sheet1", column: "contribution", score: 0.95 },
        ],
        relevantDocs: [],
      },
    });
    process.env.OPENAI_API_KEY = prevKey;
    expect(intent.intent).toBe("forecast");
    expect(intent.targetColumn).toBe("contribution");
  });
});
