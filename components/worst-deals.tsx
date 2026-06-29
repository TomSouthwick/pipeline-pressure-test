"use client";

import type { RankedDeal } from "@/lib/types";
import { DealListTable } from "./deal-list-table";

export function ForecastKillersList({ deals }: { deals: RankedDeal[] }) {
  if (deals.length === 0) {
    return (
      <div className="rounded-xl border border-good/30 bg-surface/70 p-5 text-sm text-muted">
        No high-risk deals flagged. This pipeline is unusually clean.
      </div>
    );
  }

  return (
    <DealListTable
      deals={deals}
      showSeverity
      showRank
      issueHeader="Primary flag"
      riskSortLabel="Severity"
    />
  );
}

/** @deprecated Use ForecastKillersList — kept for backwards compatibility during refactor */
export { ForecastKillersList as WorstDeals };
