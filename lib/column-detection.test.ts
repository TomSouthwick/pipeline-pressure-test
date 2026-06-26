import { describe, it, expect } from "vitest";
import { autoDetect, defaultLateStagesFor } from "./column-detection";
import { HIGH_CONFIDENCE } from "./scoring-config";
import type { Mapping } from "./types";

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

  it("selects default late stages from CRM defaults", () => {
    const rows = [
      { Stage: "Open", Amount: "100" },
      { Stage: "Commit", Amount: "200" },
      { Stage: "Negotiation/Review", Amount: "300" },
    ];
    const mapping = { stage: "Stage" } as Mapping;
    const late = defaultLateStagesFor(rows, mapping, [
      "commit",
      "negotiation/review",
    ]);
    expect(late).toContain("Commit");
    expect(late).toContain("Negotiation/Review");
    expect(late).not.toContain("Open");
  });
});
