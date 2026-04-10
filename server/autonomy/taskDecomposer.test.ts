import { describe, it, expect } from "vitest";
import { decomposeTasks } from "./taskDecomposer";

describe("taskDecomposer", () => {
  it("decomposes minimize_default_rate into ordered tasks", () => {
    const { tasks } = decomposeTasks({
      objective: "minimize_default_rate",
      label: "x",
      constraints: [],
      metrics: ["default_rate"],
    });
    expect(tasks[0]).toContain("historical");
    expect(tasks).toContain("simulate interventions");
  });
});
