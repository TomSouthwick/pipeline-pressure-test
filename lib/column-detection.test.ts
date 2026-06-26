import { describe, it, expect } from "vitest";
import { autoDetect } from "./column-detection";
import { HIGH_CONFIDENCE } from "./scoring-config";

describe("column-detection", () => {
  it("assigns each header at most once", () => {
    const headers = ["Deal Name", "Amount", "Stage", "Close Date"];
    const rows = [
      { "Deal Name": "A", Amount: "1000", Stage: "Open", "Close Date": "6/1/2026" },
    ];
    const { mapping } = autoDetect(headers, rows);
    const used = Object.values(mapping).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
  });

  it("marks synonym matches at high confidence", () => {
    const headers = ["Opportunity Name", "Amount", "Stage"];
    const rows = [{ "Opportunity Name": "X", Amount: "$1,000", Stage: "Open" }];
    const { guesses } = autoDetect(headers, rows);
    const deal = guesses.find((g) => g.field === "dealName")!;
    expect(deal.confidence).toBeGreaterThanOrEqual(HIGH_CONFIDENCE);
    expect(deal.header).toBe("Opportunity Name");
  });
});
