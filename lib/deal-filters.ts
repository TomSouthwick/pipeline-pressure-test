import type { CategoryResult, RankedDeal } from "./types";

export type CategoryKey = CategoryResult["key"];

export const FLAGS_BY_CATEGORY: Record<CategoryKey, readonly string[]> = {
  hygiene: [
    "missing_amount",
    "missing_close_date",
    "overdue",
    "missing_owner",
    "missing_next_step",
  ],
  momentum: ["stale_14", "stale_30", "stale_60", "zombie"],
  concentration: ["late_stage_stale"],
  coverage: [],
};

export function dealHasCategoryFlag(deal: RankedDeal, key: CategoryKey): boolean {
  if (key === "coverage") return false;
  const codes = FLAGS_BY_CATEGORY[key];
  return deal.flags.some((f) => codes.includes(f));
}

export function dealsForCategory(
  deals: RankedDeal[],
  key: CategoryKey
): RankedDeal[] {
  if (key === "coverage") return [];
  return deals.filter((d) => dealHasCategoryFlag(d, key));
}

export function dealsAtRisk(deals: RankedDeal[]): RankedDeal[] {
  return deals.filter((d) => d.riskScore > 0);
}
