import { describe, it, expect } from "vitest";
import {
  dealsAtRisk,
  dealsForCategory,
  primaryReasonForCategory,
} from "./deal-filters";
import type { RankedDeal } from "./types";

function deal(
  overrides: Partial<RankedDeal> & Pick<RankedDeal, "rowIndex" | "name">
): RankedDeal {
  return {
    amount: null,
    stage: null,
    owner: null,
    closeDate: null,
    riskScore: 0,
    primaryReason: "",
    reasons: [],
    flags: [],
    strengths: [],
    createdDate: null,
    lastActivity: null,
    nextStep: null,
    probability: null,
    forecastCategory: null,
    daysSinceActivity: null,
    ...overrides,
  };
}

describe("deal-filters", () => {
  const deals: RankedDeal[] = [
    deal({
      rowIndex: 0,
      name: "Clean",
      riskScore: 0,
      flags: [],
    }),
    deal({
      rowIndex: 1,
      name: "Hygiene issue",
      riskScore: 5,
      flags: ["missing_owner"],
    }),
    deal({
      rowIndex: 2,
      name: "Momentum issue",
      riskScore: 8,
      flags: ["stale_30"],
    }),
    deal({
      rowIndex: 3,
      name: "Both",
      riskScore: 12,
      flags: ["overdue", "stale_14"],
    }),
    deal({
      rowIndex: 4,
      name: "Concentration",
      riskScore: 20,
      flags: ["late_stage_stale"],
    }),
  ];

  it("filters hygiene flags correctly", () => {
    const hygiene = dealsForCategory(deals, "hygiene");
    expect(hygiene.map((d) => d.name)).toEqual(["Hygiene issue", "Both"]);
  });

  it("filters momentum flags correctly", () => {
    const momentum = dealsForCategory(deals, "momentum");
    expect(momentum.map((d) => d.name)).toEqual(["Momentum issue", "Both"]);
  });

  it("filters concentration flags correctly", () => {
    const concentration = dealsForCategory(deals, "concentration");
    expect(concentration.map((d) => d.name)).toEqual(["Concentration"]);
  });

  it("returns empty for coverage category", () => {
    expect(dealsForCategory(deals, "coverage")).toEqual([]);
  });

  it("dealsAtRisk returns deals with riskScore > 0", () => {
    const atRisk = dealsAtRisk(deals);
    expect(atRisk).toHaveLength(4);
    expect(atRisk.every((d) => d.riskScore > 0)).toBe(true);
  });

  it("primaryReasonForCategory returns category-scoped reason from parallel arrays", () => {
    const mixed = deal({
      rowIndex: 5,
      name: "Mixed",
      riskScore: 20,
      flags: ["late_stage_stale", "missing_owner"],
      reasons: ["Late-stage commit, no activity", "Missing owner"],
    });
    expect(primaryReasonForCategory(mixed, "hygiene")).toBe("Missing owner");
    expect(primaryReasonForCategory(mixed, "concentration")).toBe(
      "Late-stage commit, no activity"
    );
    expect(primaryReasonForCategory(mixed, "coverage")).toBe("");
  });
});
