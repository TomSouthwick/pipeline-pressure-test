"use client";

import * as React from "react";
import type { RankedDeal, Status } from "@/lib/types";
import type { CategoryKey } from "@/lib/deal-filters";
import {
  dealsForCategory,
  dealsCleanForCategory,
  dealsForFlag,
  dealsTopRisk,
} from "@/lib/deal-filters";
import { riskTier } from "@/lib/deal-list-utils";
import { FLAG_META } from "@/lib/scoring-config";
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
  flagFilter = null,
  onClearFlagFilter,
}: {
  rankedDeals: RankedDeal[];
  activeTab: DealExplorerTab;
  onTabChange: (tab: DealExplorerTab) => void;
  categoryStatuses?: Partial<Record<CategoryKey, Status>>;
  /** When set, the category list narrows to deals tripping this one flag. */
  flagFilter?: string | null;
  onClearFlagFilter?: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const topRisk = dealsTopRisk(rankedDeals);
  const criticalCount = topRisk.filter((d) => riskTier(d.riskScore) === "critical").length;
  const atRiskCount = topRisk.filter((d) => riskTier(d.riskScore) === "at-risk").length;

  const isCategoryTab =
    activeTab === "hygiene" ||
    activeTab === "momentum" ||
    activeTab === "concentration";

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

        {isCategoryTab && (
          <CategoryDealList
            key={activeTab}
            allDeals={rankedDeals}
            category={activeTab}
            status={categoryStatuses?.[activeTab]}
            flagFilter={flagFilter}
            onClearFlagFilter={onClearFlagFilter}
          />
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

function FlagFilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-accent/15 cursor-pointer transition-colors"
    >
      {label}
      <span className="text-muted-2" aria-hidden>
        ✕
      </span>
      <span className="sr-only">clear filter</span>
    </button>
  );
}

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  hygiene: "Hygiene",
  momentum: "Momentum",
  concentration: "Concentration",
  coverage: "Coverage",
};

/** Two-segment switch between flagged and clean deals within a category. */
function CategoryViewToggle({
  view,
  flaggedCount,
  cleanCount,
  onChange,
}: {
  view: "flagged" | "clean";
  flaggedCount: number;
  cleanCount: number;
  onChange: (view: "flagged" | "clean") => void;
}) {
  const seg = (id: "flagged" | "clean", label: string, count: number) => (
    <button
      type="button"
      onClick={() => onChange(id)}
      aria-pressed={view === id}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors",
        view === id
          ? "bg-accent/15 border border-accent/60 text-foreground"
          : "border border-transparent text-muted hover:text-foreground"
      )}
    >
      {label} <span className="tnum text-muted-2">{count}</span>
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border-strong p-0.5">
      {seg("flagged", "Needs attention", flaggedCount)}
      {seg("clean", "Clean", cleanCount)}
    </div>
  );
}

/** The shared deal table used for flagged / clean / flag-filtered lists. */
function CategoryDealTable({ deals }: { deals: RankedDeal[] }) {
  const [expandedRow, setExpandedRow] = React.useState<number | null>(null);
  return (
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
          <DealRow
            key={d.rowIndex}
            deal={d}
            expanded={expandedRow === d.rowIndex}
            onToggle={() =>
              setExpandedRow((prev) => (prev === d.rowIndex ? null : d.rowIndex))
            }
          />
        ))}
      </div>
    </div>
  );
}

function CategoryDealList({
  allDeals,
  category,
  status,
  flagFilter,
  onClearFlagFilter,
}: {
  allDeals: RankedDeal[];
  category: CategoryKey;
  status?: Status;
  flagFilter?: string | null;
  onClearFlagFilter?: () => void;
}) {
  const flagged = dealsForCategory(allDeals, category);
  // Clean-for-this-category, lowest overall risk first — so genuinely clean
  // deals lead as positive proof and any "clean here but risky elsewhere"
  // deals sink to the bottom (still shown honestly with their real badge).
  const clean = [...dealsCleanForCategory(allDeals, category)].sort(
    (a, b) => a.riskScore - b.riskScore || (b.amount ?? 0) - (a.amount ?? 0)
  );

  // Healthy categories open on their clean deals (positive proof); everything
  // else opens on what needs attention. A flag drill-down is a temporary
  // detour: while it's active we show the filtered list regardless of `view`,
  // and clearing it returns to this default — so for a category whose only
  // per-deal flag IS the drilled one (e.g. Concentration's late-stage-stale),
  // clearing reveals the rest of the category rather than re-showing the same
  // handful of deals.
  const [view, setView] = React.useState<"flagged" | "clean">(
    status === "good" ? "clean" : "flagged"
  );

  const flagLabel = flagFilter
    ? FLAG_META[flagFilter]?.label ?? flagFilter
    : null;

  // --- Flag drill-down: chip + only the deals tripping that one flag ---
  if (flagLabel != null) {
    const filtered = dealsForFlag(allDeals, flagFilter!);
    return (
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-muted-2">Showing</span>
          <FlagFilterChip label={flagLabel} onClear={onClearFlagFilter} />
        </div>
        <DealExplorerPanelHeader eyebrow={CATEGORY_LABELS[category]}>
          <span className="tnum">{filtered.length}</span> deal
          {filtered.length === 1 ? "" : "s"} with &ldquo;{flagLabel}&rdquo;
        </DealExplorerPanelHeader>
        {filtered.length > 0 && <CategoryDealTable deals={filtered} />}
      </div>
    );
  }

  // --- Default: flagged / clean toggle ---
  const deals = view === "clean" ? clean : flagged;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <DealExplorerPanelHeader eyebrow={CATEGORY_LABELS[category]}>
          {view === "clean" ? (
            <>
              <span className="tnum">{clean.length}</span> clean deal
              {clean.length === 1 ? "" : "s"} in {CATEGORY_LABELS[category]}
            </>
          ) : (
            flaggedDealCount(flagged.length)
          )}
        </DealExplorerPanelHeader>
        <CategoryViewToggle
          view={view}
          flaggedCount={flagged.length}
          cleanCount={clean.length}
          onChange={setView}
        />
      </div>

      {deals.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface/70 p-4 text-sm text-muted">
          {view === "clean"
            ? "No fully clean deals in this category."
            : "No deals flagged — every deal passes this category's checks."}
        </p>
      ) : (
        <CategoryDealTable deals={deals} />
      )}
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
