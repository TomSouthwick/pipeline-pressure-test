"use client";

import * as React from "react";
import type { RankedDeal } from "@/lib/types";
import { sortDeals, type DealSortKey } from "@/lib/deal-list-utils";
import { DealRow, SortBtn } from "./deal-row";

export function ForecastKillersList({ deals }: { deals: RankedDeal[] }) {
  const [sortKey, setSortKey] = React.useState<DealSortKey>("risk");
  const [sortAsc, setSortAsc] = React.useState(false);
  const [expandedRow, setExpandedRow] = React.useState<number | null>(null);

  const sorted = React.useMemo(
    () => sortDeals(deals, sortKey, sortAsc),
    [deals, sortKey, sortAsc]
  );

  const toggleSort = (key: DealSortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  if (deals.length === 0) {
    return (
      <div className="rounded-xl border border-good/30 bg-surface/70 p-5 text-sm text-muted">
        No high-risk deals flagged. This pipeline is unusually clean.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs">
        <span className="text-muted-2">Sort by</span>
        <SortBtn label="Risk" active={sortKey === "risk"} onClick={() => toggleSort("risk")} />
        <SortBtn label="Amount" active={sortKey === "amount"} onClick={() => toggleSort("amount")} />
        <SortBtn label="Name" active={sortKey === "name"} onClick={() => toggleSort("name")} />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="hidden sm:flex items-center gap-3 px-3 py-2 border-b border-border bg-surface/80 text-xs text-muted">
          <span className="w-5 shrink-0">#</span>
          <span className="flex-1">
            <SortBtn label="Deal" active={sortKey === "name"} onClick={() => toggleSort("name")} />
          </span>
          <span className="w-24 text-right">
            <SortBtn label="Amount" active={sortKey === "amount"} onClick={() => toggleSort("amount")} />
          </span>
          <span className="max-w-[100px] hidden md:block">Stage</span>
          <span className="w-12">
            <SortBtn label="Risk" active={sortKey === "risk"} onClick={() => toggleSort("risk")} />
          </span>
          <span className="max-w-[180px] hidden lg:block">Primary flag</span>
          <span className="w-4" />
        </div>

        <div className="sm:divide-y sm:divide-border/60 flex flex-col gap-2 sm:gap-0 p-2 sm:p-0">
          {sorted.map((d, i) => (
            <div key={d.rowIndex}>
              <DealRow
                deal={d}
                rank={i + 1}
                expanded={expandedRow === d.rowIndex}
                onToggle={() =>
                  setExpandedRow((prev) => (prev === d.rowIndex ? null : d.rowIndex))
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use ForecastKillersList — kept for backwards compatibility during refactor */
export { ForecastKillersList as WorstDeals };
