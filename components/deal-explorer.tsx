"use client";

import * as React from "react";
import type { RankedDeal, Status } from "@/lib/types";
import type { CategoryKey } from "@/lib/deal-filters";
import { dealsForCategory, dealsTopRisk } from "@/lib/deal-filters";
import { riskTier } from "@/lib/deal-list-utils";
import { STATUS_STYLES } from "@/lib/status-styles";
import { ForecastKillersList } from "./worst-deals";
import { DealRow, DEAL_COLS } from "./deal-row";
import { DealDrawer } from "./deal-drawer";
import { cn } from "@/lib/cn";

export type DealExplorerTab = "top-risks" | CategoryKey | "all";

const AGGREGATE_TABS: { id: DealExplorerTab; label: string }[] = [
  { id: "top-risks", label: "Top risks" },
  { id: "all", label: "All" },
];

const CATEGORY_TABS: { id: CategoryKey; label: string }[] = [
  { id: "hygiene", label: "Hygiene" },
  { id: "momentum", label: "Momentum" },
  { id: "concentration", label: "Concentration" },
];

/**
 * One tab. Selection always uses the same accent treatment so "selected" never
 * reads as "good/bad". A category's health is shown by a small status dot
 * instead, keeping selection and health visually independent.
 */
function ExplorerTab({
  label,
  active,
  status,
  onClick,
}: {
  label: string;
  active: boolean;
  status?: Status;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border cursor-pointer transition-colors",
        active
          ? "bg-accent/15 border-accent/60 text-foreground"
          : "border-border-strong text-muted hover:text-foreground"
      )}
    >
      {status && (
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_STYLES[status].dot)} />
      )}
      {label}
    </button>
  );
}

function DealExplorerPanelHeader({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <p className="eyebrow text-muted-2 mb-1">{eyebrow}</p>
      <p className="text-sm font-medium text-foreground">{children}</p>
    </div>
  );
}

function flaggedDealCount(count: number): React.ReactNode {
  return (
    <>
      <span className="tnum">{count}</span> deal{count === 1 ? "" : "s"} flagged
    </>
  );
}

export function categoryKeyToTab(key: CategoryKey): DealExplorerTab {
  return key;
}

export function DealExplorer({
  rankedDeals,
  activeTab,
  onTabChange,
  categoryStatuses,
}: {
  rankedDeals: RankedDeal[];
  activeTab: DealExplorerTab;
  onTabChange: (tab: DealExplorerTab) => void;
  categoryStatuses?: Partial<Record<CategoryKey, Status>>;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const topRisk = dealsTopRisk(rankedDeals);
  const criticalCount = topRisk.filter((d) => riskTier(d.riskScore) === "critical").length;
  const atRiskCount = topRisk.filter((d) => riskTier(d.riskScore) === "at-risk").length;

  const categoryDeals =
    activeTab === "top-risks" || activeTab === "all" || activeTab === "coverage"
      ? []
      : dealsForCategory(rankedDeals, activeTab);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {AGGREGATE_TABS.map((tab) => (
          <ExplorerTab
            key={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
        <span className="mx-1 h-4 w-px bg-border-strong" aria-hidden />
        {CATEGORY_TABS.map((tab) => (
          <ExplorerTab
            key={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            status={categoryStatuses?.[tab.id]}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>

      <div className="max-h-[min(480px,50vh)] overflow-y-auto rounded-xl border border-border bg-surface/40 p-3 sm:p-4">
        {activeTab === "top-risks" && (
          <>
            <DealExplorerPanelHeader eyebrow="Top risks">
              {topRisk.length === 0 ? (
                "No critical or at-risk deals"
              ) : (
                <>
                  <span className="tnum">{criticalCount}</span> critical
                  {" · "}
                  <span className="tnum">{atRiskCount}</span> at risk
                </>
              )}
            </DealExplorerPanelHeader>
            <ForecastKillersList deals={topRisk} />
          </>
        )}

        {(activeTab === "hygiene" ||
          activeTab === "momentum" ||
          activeTab === "concentration") && (
          <CategoryDealList deals={categoryDeals} category={activeTab} />
        )}

        {activeTab === "coverage" && <CoverageEmptyState />}

        {activeTab === "all" && (
          <AllDealsSummary
            total={rankedDeals.length}
            atRisk={topRisk.length}
            onBrowse={() => setDrawerOpen(true)}
          />
        )}
      </div>

      <DealDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        deals={rankedDeals}
      />
    </div>
  );
}

function CategoryDealList({
  deals,
  category,
}: {
  deals: RankedDeal[];
  category: CategoryKey;
}) {
  const labels: Record<CategoryKey, string> = {
    hygiene: "Hygiene",
    momentum: "Momentum",
    concentration: "Concentration",
    coverage: "Coverage",
  };

  if (deals.length === 0) {
    return (
      <DealExplorerPanelHeader eyebrow={labels[category]}>
        No deals flagged
      </DealExplorerPanelHeader>
    );
  }

  return (
    <div>
      <DealExplorerPanelHeader eyebrow={labels[category]}>
        {flaggedDealCount(deals.length)}
      </DealExplorerPanelHeader>
      <div className="rounded-xl border border-border overflow-hidden">
      <div className="hidden sm:flex items-center gap-3 px-3 py-2 border-b border-border bg-surface/80 text-xs text-muted">
        <span className={DEAL_COLS.name}>Deal</span>
        <span className={DEAL_COLS.amount}>Amount</span>
        <span className={DEAL_COLS.stage}>Stage</span>
        <span className={DEAL_COLS.severity}>Severity</span>
        <span className={DEAL_COLS.flag}>Primary flag</span>
        <span className={DEAL_COLS.chevron} />
      </div>
      <div className="sm:divide-y sm:divide-border/60 flex flex-col gap-2 sm:gap-0 p-2 sm:p-0">
        {deals.map((d) => (
          <DealRow key={d.rowIndex} deal={d} />
        ))}
      </div>
      </div>
    </div>
  );
}

function CoverageEmptyState() {
  return (
    <div className="rounded-xl border border-border bg-surface/70 p-5 text-sm text-muted text-center">
      <p className="font-medium text-foreground">Coverage is a pipeline-level check</p>
      <p className="mt-2 leading-relaxed">
        Enter a quarterly or annual target on the mapping screen and map close
        date. Coverage compares pipeline closing in that period to your target.
        Individual deals are not flagged here.
      </p>
    </div>
  );
}

function AllDealsSummary({
  total,
  atRisk,
  onBrowse,
}: {
  total: number;
  atRisk: number;
  onBrowse: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
      <p className="text-sm text-muted">
        <span className="tnum font-medium text-foreground">{total}</span> deals ·{" "}
        <span className="tnum font-medium text-foreground">{atRisk}</span> at risk
      </p>
      <button
        type="button"
        onClick={onBrowse}
        className="rounded-full border border-accent/60 bg-accent/10 px-5 py-2 text-sm font-medium text-foreground hover:bg-accent/15 cursor-pointer transition-colors"
      >
        Browse all deals →
      </button>
    </div>
  );
}
