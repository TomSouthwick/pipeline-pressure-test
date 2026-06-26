import type { RankedDeal } from "./types";
import { WEIGHTS } from "./scoring-config";

export type DealFilter = "all" | "at-risk" | "critical" | "clean";
export type DealSortKey = "risk" | "amount" | "closeDate" | "name";

const CRITICAL_THRESHOLD = WEIGHTS.lateStageStale;

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
