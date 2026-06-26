"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { DiagnosticResult, Mapping } from "@/lib/types";

const FIELD_LABELS: Record<string, string> = {
  dealName: "Deal name",
  amount: "Amount",
  stage: "Stage",
  owner: "Owner",
  closeDate: "Close date",
  createdDate: "Created date",
  lastActivity: "Last activity",
  nextStep: "Next step",
  probability: "Probability",
  forecastCategory: "Forecast category",
};

const SKIP_HINTS: Record<string, string> = {
  Momentum: "Add a Last Activity column to unlock Momentum scoring.",
  "Activity recency": "Map a Last Activity column to score deal recency.",
  "Coverage & realism": "Enter a target on the mapping step and map close date to score coverage.",
  "Late-stage + stale combo": "Select late/commit stages and map Last Activity.",
  "Stuck in stage": "Requires stage-change history (not in a single export).",
};

export function MethodologyPanel({
  result,
  mapping,
  variant = "default",
  leading,
}: {
  result: DiagnosticResult;
  mapping: Mapping;
  variant?: "default" | "header";
  leading?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const { meta } = result;
  const isHeader = variant === "header";

  const weightingLabel =
    meta.weightingMethod === "crm-probability"
      ? `Weighted using your CRM probabilities (${meta.dealsWithProbability}/${meta.dealsAnalyzed} deals)`
      : meta.weightingMethod === "stage-map"
        ? "Weighted using stage-based estimates (no CRM probability column mapped)"
        : "Weighted pipeline not computed (no amount column)";

  return (
    <div className={isHeader ? "mb-6" : "mt-8 border-t border-border pt-6"}>
      <div
        className={
          isHeader ? "flex items-center justify-between gap-4" : undefined
        }
      >
        {leading}
        {isHeader ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0"
          >
            How this score works
            <span className="text-muted-2">{open ? "▾" : "▸"}</span>
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center justify-between text-sm font-medium text-foreground cursor-pointer hover:text-accent transition-colors"
          >
            <span>How this score works</span>
            <span className="text-muted-2 text-xs">{open ? "▾" : "▸"}</span>
          </button>
        )}
      </div>

      {open && (
        <div
          className={
            isHeader
              ? "mt-4 space-y-5 text-sm text-muted leading-relaxed border-t border-border pt-4"
              : "mt-4 space-y-5 text-sm text-muted leading-relaxed"
          }
        >
          {meta.insufficientData ? (
            <p className="text-foreground">
              Not enough columns were mapped to produce a score. Map at least
              Amount or Stage plus supporting fields, then run again.
            </p>
          ) : (
            <p>
              Your <strong className="text-foreground font-medium">0–100 score</strong>{" "}
              is the applicable category scores (each out of 25) rescaled to 100.
              Categories with missing data are excluded — if you skip quota,
              Coverage drops out and the other three rescale.
            </p>
          )}

          <div>
            <p className="text-xs eyebrow text-muted-2 mb-2">Categories</p>
            <ul className="space-y-1.5 text-xs">
              <li>
                <strong className="text-foreground">Hygiene</strong> — missing
                amount, close date, owner, next step
              </li>
              <li>
                <strong className="text-foreground">Momentum</strong> — activity
                recency and zombie deals (old + early stage)
              </li>
              <li>
                <strong className="text-foreground">Concentration & risk</strong>{" "}
                — quarter-end bunching, top-3 concentration, late-stage gone quiet
              </li>
              <li>
                <strong className="text-foreground">Coverage & realism</strong>{" "}
                — pipeline closing this quarter or year vs your target (optional;
                needs close date)
              </li>
            </ul>
          </div>

          {meta.quota != null && meta.periodLabel && meta.periodOpenValue != null && (
            <div>
              <p className="text-xs eyebrow text-muted-2 mb-2">Period coverage</p>
              <p className="text-xs">
                {meta.quotaPeriod === "year" ? "Annual" : "Quarterly"} target of{" "}
                {meta.quota.toLocaleString("en-GB", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })}{" "}
                compared to {meta.periodDealsIncluded} deals (
                {meta.periodOpenValue.toLocaleString("en-GB", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })}
                ) closing in {meta.periodLabel}.
                {meta.periodDealsExcluded > 0 && (
                  <>
                    {" "}
                    {meta.periodDealsExcluded} deals excluded (no close date or
                    outside {meta.periodLabel}).
                  </>
                )}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs eyebrow text-muted-2 mb-2">Data used</p>
            <p className="text-xs">{weightingLabel}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {meta.mappedFields.map((f) => (
                <span
                  key={f}
                  className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-foreground"
                >
                  {FIELD_LABELS[f] ?? f}
                  {mapping[f] ? `: ${mapping[f]}` : ""}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs eyebrow text-muted-2 mb-2">Worst deals</p>
            <p className="text-xs">
              Ranked by per-deal risk score (sum of weighted flags). Late-stage +
              stale is the heaviest single flag. The list above is the top of the
              same ranking shown in the deal table.
            </p>
          </div>

          {result.skippedChecks.length > 0 && (
            <div>
              <p className="text-xs eyebrow text-muted-2 mb-2">Skipped checks</p>
              <ul className="space-y-1 text-xs">
                {result.skippedChecks.map((c) => (
                  <li key={c.name} className="flex gap-2">
                    <span className="text-muted-2 shrink-0">–</span>
                    <span>
                      <span className="text-foreground">{c.name}</span>
                      {SKIP_HINTS[c.name] ?? ` (${c.reason})`}
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
