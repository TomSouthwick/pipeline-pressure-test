"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ScoreDial } from "./score-dial";
import { CategoryCard } from "./category-card";
import { DealExplorer, categoryKeyToTab, type DealExplorerTab } from "./deal-explorer";
import { DealCardProvider } from "./deal-card";
import { MethodologyPanel } from "./methodology-panel";
import { OutputsBar } from "./outputs-bar";
import { Button } from "@/components/ui/button";
import { CRM_LABEL, type CrmGuess } from "@/lib/crm-detection";
import { gradeStatus } from "@/lib/scoring-config";
import { STATUS_STYLES } from "@/lib/status-styles";
import { cn } from "@/lib/cn";
import type { DiagnosticResult, Mapping, Status } from "@/lib/types";
import type { CategoryKey } from "@/lib/deal-filters";

function money(n: number): string {
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function weightingSummary(result: DiagnosticResult): string | null {
  const { meta } = result;
  if (meta.weightedPipeline == null) return null;
  if (meta.weightingMethod === "crm-probability") {
    return `Weighted using CRM probabilities (${meta.dealsWithProbability}/${meta.dealsAnalyzed} deals)`;
  }
  if (meta.weightingMethod === "stage-map") {
    return "Weighted using stage estimates";
  }
  return null;
}

export function ResultReveal({
  result,
  mapping,
  originalHeaders,
  isSample = false,
  crm,
  onBack,
  onReset,
}: {
  result: DiagnosticResult;
  mapping: Mapping;
  originalHeaders: string[];
  isSample?: boolean;
  crm?: CrmGuess;
  onBack: () => void;
  onReset: () => void;
}) {
  const insufficient = result.meta.insufficientData;
  const weighting = weightingSummary(result);
  const sampleLabel =
    isSample && crm?.crm ? `Sample: ${CRM_LABEL[crm.crm]} export` : null;
  const [activeTab, setActiveTab] = React.useState<DealExplorerTab>("top-risks");
  const [flagFilter, setFlagFilter] = React.useState<string | null>(null);
  const explorerRef = React.useRef<HTMLDivElement>(null);

  const tabForCategory = (key: DealExplorerTab) => activeTab === key;

  // Selecting a tab always clears any active single-flag drill-down.
  const selectTab = (tab: DealExplorerTab) => {
    setActiveTab(tab);
    setFlagFilter(null);
  };

  const scrollToExplorer = () =>
    requestAnimationFrame(() =>
      explorerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );

  // Drill from a category finding into exactly the deals that tripped its flag.
  const selectFinding = (key: CategoryKey, flagCode: string) => {
    setActiveTab(categoryKeyToTab(key));
    setFlagFilter(flagCode);
    scrollToExplorer();
  };

  // Clearing the drill keeps the explorer anchored so the list doesn't appear
  // to jump up as the filter chip is removed.
  const clearFlagFilter = () => {
    setFlagFilter(null);
    scrollToExplorer();
  };

  const categoryStatuses = Object.fromEntries(
    result.categories.map((c) => [c.key, c.status])
  ) as Partial<Record<CategoryKey, Status>>;

  return (
    <DealCardProvider>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-3xl mx-auto"
      >
        <MethodologyPanel
        result={result}
        mapping={mapping}
        variant="header"
        leading={
          <Button variant="secondary" size="sm" onClick={onBack}>
            <BackIcon />
            {isSample ? "Back to mapping" : "Back to configuration"}
          </Button>
        }
      />

      <ChecksNote result={result} />

      {insufficient ? (
        <div className="rounded-xl border border-warn/40 bg-warn/5 px-5 py-6 text-center">
          <p className="eyebrow text-warn">Insufficient data</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {result.grade}
          </h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto">
            Map more columns — at minimum Amount and Stage — then run again for
            a full pipeline health score.
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
          <ScoreDial score={result.score ?? 0} grade="" />
          <div className="text-center sm:text-left">
            <p className="eyebrow text-accent">Pipeline health</p>
            <h2
              className={cn(
                "mt-1 text-2xl font-semibold tracking-tight",
                STATUS_STYLES[gradeStatus(result.score ?? 0)].text
              )}
            >
              {result.grade}
            </h2>
            <p className="mt-2 text-sm text-muted leading-relaxed max-w-sm">
              {result.meta.dealsAnalyzed} open deals ·{" "}
              <span className="tnum">{money(result.meta.totalOpenValue)}</span>{" "}
              total value
              {result.meta.weightedPipeline != null && (
                <>
                  {" "}
                  ·{" "}
                  <span className="tnum">
                    {money(result.meta.weightedPipeline)}
                  </span>{" "}
                  weighted
                </>
              )}
            </p>
            {weighting && (
              <p className="mt-1 text-xs text-muted-2">{weighting}</p>
            )}
            {result.meta.quota != null &&
              result.meta.periodLabel &&
              result.meta.periodOpenValue != null && (
                <p className="mt-1 text-xs text-muted-2">
                  {money(result.meta.periodOpenValue)} closing in{" "}
                  {result.meta.periodLabel}
                  {result.meta.quotaPeriod === "year" ? " (annual target)" : " (quarterly target)"}
                </p>
              )}
            {result.meta.quota == null && (
              <p className="mt-3 text-xs text-muted-2 max-w-sm leading-relaxed">
                Headline score blends hygiene, momentum, and concentration. Add
                a quota to fold in coverage, weighted by each deal&apos;s CRM
                probability.
              </p>
            )}
            {sampleLabel && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted">
                {sampleLabel}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {result.categories.map((c, i) => {
          // Coverage is pipeline-level (no per-deal list), so its card is
          // display-only — selecting it would land on an empty tab.
          const isCoverage = c.key === "coverage";
          return (
            <CategoryCard
              key={c.key}
              category={c}
              index={i}
              selected={!isCoverage && tabForCategory(categoryKeyToTab(c.key))}
              onSelect={
                isCoverage ? undefined : () => selectTab(categoryKeyToTab(c.key))
              }
              onFindingSelect={
                isCoverage ? undefined : (code) => selectFinding(c.key, code)
              }
            />
          );
        })}
      </div>

      {!insufficient && (
        <div ref={explorerRef} className="scroll-mt-4">
          <DealExplorer
            rankedDeals={result.rankedDeals}
            activeTab={activeTab}
            onTabChange={selectTab}
            categoryStatuses={categoryStatuses}
            flagFilter={flagFilter}
            onClearFlagFilter={clearFlagFilter}
          />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="mt-8 border-t border-border pt-6"
      >
        <OutputsBar
          result={result}
          originalHeaders={originalHeaders}
          onReset={onReset}
        />
      </motion.div>
    </motion.div>
    </DealCardProvider>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChecksNote({ result }: { result: DiagnosticResult }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="-mt-4 mb-6 text-xs text-muted-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="hover:text-muted transition-colors cursor-pointer"
        >
          {open ? "▾" : "▸"} {result.ranChecks.length} checks ran
          {result.skippedChecks.length > 0
            ? `, ${result.skippedChecks.length} skipped`
            : ""}
        </button>
      </div>
      {open && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-muted mb-1">Ran</div>
            <ul className="space-y-0.5">
              {result.ranChecks.map((c) => (
                <li key={c} className="flex gap-1.5">
                  <span className="text-good">✓</span> {c}
                </li>
              ))}
            </ul>
          </div>
          {result.skippedChecks.length > 0 && (
            <div>
              <div className="text-muted mb-1">Skipped</div>
              <ul className="space-y-0.5">
                {result.skippedChecks.map((c) => (
                  <li key={c.name} className="flex gap-1.5">
                    <span className="text-muted-2">–</span>
                    <span>
                      {c.name}{" "}
                      <span className="text-muted-2">({c.reason})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
