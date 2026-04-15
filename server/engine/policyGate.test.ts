import { describe, expect, it } from "vitest";
import { evaluatePolicyGate } from "./policyGate.js";

describe("evaluatePolicyGate", () => {
  it("blocks unknown intent", async () => {
    const result = await evaluatePolicyGate({
      regulator: "CBK",
      intent: {
        intent: "unknown",
        scope: "unknown",
        regulation: "CBK",
        confidence: 0.9,
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresApproval).toBe(false);
  });

  it("marks provisioning as high risk and requires approval", async () => {
    const result = await evaluatePolicyGate({
      regulator: "SASRA",
      intent: {
        intent: "calculate_provisioning",
        scope: "column_range",
        regulation: "SASRA",
        confidence: 0.95,
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.risk).toBe("high");
    expect(result.requiresApproval).toBe(true);
  });
});
