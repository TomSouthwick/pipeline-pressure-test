"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ScoreDial } from "./score-dial";
import { CategoryCard } from "./category-card";
import { DealExplorer, categoryKeyToTab, type DealExplorerTab } from "./deal-explorer";
import { MethodologyPanel } from "./methodology-panel";
import { OutputsBar } from "./outputs-bar";
import { Button } from "@/components/ui/button";
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
  onBack,
  onReset,
}: {
  result: DiagnosticResult;
  mapping: Mapping;
  originalHeaders: string[];
  isSample?: boolean;
  onBack: () => void;
  onReset: () => void;
}) {
  const insufficient = result.meta.insufficientData;
  const weighting = weightingSummary(result);
  const [activeTab, setActiveTab] = React.useState<DealExplorerTab>("top-risks");

  const tabForCategory = (key: DealExplorerTab) => activeTab === key;

  const categoryStatuses = Object.fromEntries(
    result.categories.map((c) => [c.key, c.status])
  ) as Partial<Record<CategoryKey, Status>>;

  return (
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
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
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
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {result.categories.map((c, i) => (
          <CategoryCard
            key={c.key}
            category={c}
            index={i}
            selected={tabForCategory(categoryKeyToTab(c.key))}
            onSelect={() => setActiveTab(categoryKeyToTab(c.key))}
          />
        ))}
      </div>

      {!insufficient && (
        <DealExplorer
          rankedDeals={result.rankedDeals}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          categoryStatuses={categoryStatuses}
        />
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

      <ChecksNote result={result} />
    </motion.div>
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
    <div className="mt-6 text-xs text-muted-2">
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
