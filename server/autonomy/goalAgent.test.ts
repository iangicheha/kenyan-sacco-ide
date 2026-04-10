import { describe, it, expect } from "vitest";
import { parseGoal } from "./goalAgent";

describe("goalAgent", () => {
  it("maps default-reduction goals to minimize_default_rate", () => {
    const o = parseGoal("reduce loan defaults");
    expect(o.objective).toBe("minimize_default_rate");
    expect(o.metrics).toContain("default_rate");
  });

  it("uses portfolio optimization for generic goals", () => {
    const o = parseGoal("improve overall performance");
    expect(o.objective).toBe("optimize_portfolio");
  });
});
