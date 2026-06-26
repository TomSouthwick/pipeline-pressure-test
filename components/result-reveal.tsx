"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ScoreDial } from "./score-dial";
import { CategoryCard } from "./category-card";
import { WorstDeals } from "./worst-deals";
import { DealTable } from "./deal-table";
import { MethodologyPanel } from "./methodology-panel";
import { OutputsBar } from "./outputs-bar";
import { Button } from "@/components/ui/button";
import type { DiagnosticResult, Mapping } from "@/lib/types";

function money(n: number): string {
  return n.toLocaleString("en-US", {
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
  onBack,
  onReset,
}: {
  result: DiagnosticResult;
  mapping: Mapping;
  originalHeaders: string[];
  onBack: () => void;
  onReset: () => void;
}) {
  const insufficient = result.meta.insufficientData;
  const weighting = weightingSummary(result);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <Button variant="secondary" size="sm" onClick={onBack}>
          <BackIcon />
          Back to configuration
        </Button>
        <span className="text-[11px] text-muted-2">
          {result.meta.dealsAnalyzed} deals · computed in your browser
        </span>
      </div>

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
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {result.categories.map((c, i) => (
          <CategoryCard key={c.key} category={c} index={i} />
        ))}
      </div>

      {!insufficient && (
        <>
          <div className="mt-8">
            <WorstDeals deals={result.worstDeals} />
          </div>
          <DealTable deals={result.rankedDeals} />
        </>
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

      <MethodologyPanel result={result} mapping={mapping} />
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
