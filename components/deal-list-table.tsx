"use client";

import * as React from "react";
import type { RankedDeal } from "@/lib/types";
import { sortDeals, type DealSortKey } from "@/lib/deal-list-utils";
import { DealRow, SortBtn, DEAL_COLS } from "./deal-row";

export function DealListTable({
  deals,
  showSeverity = true,
  issueHeader = "Primary flag",
  riskSortLabel = "Severity",
  showRank = false,
  getIssueText,
  emptyMessage,
}: {
  deals: RankedDeal[];
  showSeverity?: boolean;
  issueHeader?: string;
  /** Sort control label for riskScore column (e.g. "Risk" when severity hidden). */
  riskSortLabel?: string;
  showRank?: boolean;
  getIssueText?: (deal: RankedDeal) => string;
  emptyMessage?: string;
}) {
  const [sortKey, setSortKey] = React.useState<DealSortKey>("risk");
  const [sortAsc, setSortAsc] = React.useState(false);

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

  if (deals.length === 0 && emptyMessage) {
    return (
      <div className="rounded-xl border border-border bg-surface/70 p-5 text-sm text-muted">
        {emptyMessage}
      </div>
    );
  }

  if (deals.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs">
        <span className="text-muted-2">Sort by</span>
        <SortBtn
          label={riskSortLabel}
          active={sortKey === "risk"}
          ascending={sortAsc}
          sortable
          onClick={() => toggleSort("risk")}
        />
        <SortBtn
          label="Amount"
          active={sortKey === "amount"}
          ascending={sortAsc}
          sortable
          onClick={() => toggleSort("amount")}
        />
        <SortBtn
          label="Close date"
          active={sortKey === "closeDate"}
          ascending={sortAsc}
          sortable
          onClick={() => toggleSort("closeDate")}
        />
        <SortBtn
          label="Name"
          active={sortKey === "name"}
          ascending={sortAsc}
          sortable
          onClick={() => toggleSort("name")}
        />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="hidden sm:flex items-center gap-3 px-3 py-2 border-b border-border bg-surface/80 text-xs text-muted">
          {showRank && <span className={DEAL_COLS.rank}>#</span>}
          <span className={DEAL_COLS.name}>
            <SortBtn
              label="Deal"
              active={sortKey === "name"}
              ascending={sortAsc}
              sortable
              onClick={() => toggleSort("name")}
            />
          </span>
          <span className={DEAL_COLS.amount}>
            <SortBtn
              label="Amount"
              active={sortKey === "amount"}
              ascending={sortAsc}
              sortable
              onClick={() => toggleSort("amount")}
            />
          </span>
          <span className={DEAL_COLS.closeDate}>
            <SortBtn
              label="Close"
              active={sortKey === "closeDate"}
              ascending={sortAsc}
              sortable
              onClick={() => toggleSort("closeDate")}
            />
          </span>
          <span className={DEAL_COLS.stage}>Stage</span>
          <span className={DEAL_COLS.probability}>Prob</span>
          {showSeverity && (
            <span className={DEAL_COLS.severity}>
              <SortBtn
                label={riskSortLabel}
                active={sortKey === "risk"}
                ascending={sortAsc}
                sortable
                onClick={() => toggleSort("risk")}
              />
            </span>
          )}
          <span className={DEAL_COLS.flag}>{issueHeader}</span>
        </div>

        <div className="sm:divide-y sm:divide-border/60 flex flex-col gap-2 sm:gap-0 p-2 sm:p-0">
          {sorted.map((d, i) => (
            <DealRow
              key={d.rowIndex}
              deal={d}
              rank={showRank ? i + 1 : undefined}
              showSeverity={showSeverity}
              reason={getIssueText?.(d)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
