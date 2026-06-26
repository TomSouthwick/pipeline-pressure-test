import { describe, it, expect } from "vitest";
import { dealsAtRisk, dealsForCategory } from "./deal-filters";
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
});
