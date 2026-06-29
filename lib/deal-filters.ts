import type { CategoryResult, RankedDeal } from "./types";
import { RISK_TIERS } from "./scoring-config";

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

/** Deals with no flag in this category — "clean" for that category's checks. */
export function dealsCleanForCategory(
  deals: RankedDeal[],
  key: CategoryKey
): RankedDeal[] {
  if (key === "coverage") return [];
  return deals.filter((d) => !dealHasCategoryFlag(d, key));
}

/** Deals that tripped one specific flag (e.g. "missing_next_step"). */
export function dealsForFlag(
  deals: RankedDeal[],
  flagCode: string
): RankedDeal[] {
  return deals.filter((d) => d.flags.includes(flagCode));
}

/** Which category a per-deal flag belongs to, or null if it maps to none. */
export function categoryForFlag(flagCode: string): CategoryKey | null {
  for (const key of Object.keys(FLAGS_BY_CATEGORY) as CategoryKey[]) {
    if (FLAGS_BY_CATEGORY[key].includes(flagCode)) return key;
  }
  return null;
}

export function dealsAtRisk(deals: RankedDeal[]): RankedDeal[] {
  return deals.filter((d) => d.riskScore > 0);
}

/**
 * Deals in the Critical or At-risk tiers (riskScore >= the At-risk threshold).
 * This is the "Top risks" set — the deals genuinely worth a forecast review.
 * Lower-scoring "Watch" deals are excluded here and live under "All".
 */
export function dealsTopRisk(deals: RankedDeal[]): RankedDeal[] {
  return deals.filter((d) => d.riskScore >= RISK_TIERS.atRisk);
}

/**
 * Highest-weight reason for flags in this category. Uses parallel flags/reasons
 * arrays (weight-sorted); returns "" for coverage or when no category flag matches.
 */
export function primaryReasonForCategory(
  deal: RankedDeal,
  key: CategoryKey
): string {
  if (key === "coverage") return "";
  const codes = new Set(FLAGS_BY_CATEGORY[key]);
  for (let i = 0; i < deal.flags.length; i++) {
    if (codes.has(deal.flags[i])) {
      return deal.reasons[i] ?? "";
    }
  }
  return "";
}
