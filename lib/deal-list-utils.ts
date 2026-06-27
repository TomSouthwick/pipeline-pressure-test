import type { RankedDeal, Status } from "./types";
import { RISK_TIERS } from "./scoring-config";

export type DealFilter = "all" | "at-risk" | "critical" | "clean";
export type DealSortKey = "risk" | "amount" | "closeDate" | "name";

const CRITICAL_THRESHOLD = RISK_TIERS.critical;

/** Human-readable severity tier for a per-deal risk score. */
export type RiskTier = "critical" | "at-risk" | "watch" | "clean";

export function riskTier(score: number): RiskTier {
  if (score >= RISK_TIERS.critical) return "critical";
  if (score >= RISK_TIERS.atRisk) return "at-risk";
  if (score > 0) return "watch";
  return "clean";
}

/** Tier -> display label + traffic-light status (drives colour via STATUS_STYLES). */
export const RISK_TIER_META: Record<RiskTier, { label: string; status: Status }> = {
  critical: { label: "Critical", status: "bad" },
  "at-risk": { label: "At risk", status: "warn" },
  watch: { label: "Watch", status: "na" },
  clean: { label: "Clean", status: "good" },
};

export function filterDeals(deals: RankedDeal[], filter: DealFilter): RankedDeal[] {
  if (filter === "at-risk") return deals.filter((d) => d.riskScore > 0);
  if (filter === "critical") return deals.filter((d) => d.riskScore >= CRITICAL_THRESHOLD);
  if (filter === "clean") return deals.filter((d) => d.riskScore === 0);
  return deals;
}

export function sortDeals(
  deals: RankedDeal[],
  sortKey: DealSortKey,
  sortAsc: boolean
): RankedDeal[] {
  const dir = sortAsc ? 1 : -1;
  return [...deals].sort((a, b) => {
    if (sortKey === "risk") return (a.riskScore - b.riskScore) * dir;
    if (sortKey === "amount") {
      if (a.amount == null && b.amount == null) return 0;
      if (a.amount == null) return 1;
      if (b.amount == null) return -1;
      return ((a.amount ?? 0) - (b.amount ?? 0)) * dir;
    }
    if (sortKey === "closeDate") {
      if (!a.closeDate && !b.closeDate) return 0;
      if (!a.closeDate) return 1;
      if (!b.closeDate) return -1;
      return a.closeDate.localeCompare(b.closeDate) * dir;
    }
    return a.name.localeCompare(b.name) * dir;
  });
}

export { CRITICAL_THRESHOLD };
