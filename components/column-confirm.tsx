"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { CanonicalField, FieldGuess, Mapping } from "@/lib/types";
import { HIGH_CONFIDENCE } from "@/lib/scoring-config";
import { distinctStageValues } from "@/lib/column-detection";
import { CRM_LABEL, type CrmGuess } from "@/lib/crm-detection";
import { isValidQuotaInput, parseQuotaInput } from "@/lib/parse";
import type { RawRow } from "@/lib/types";

const FIELD_LABELS: Record<CanonicalField, string> = {
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

const FIELD_ORDER: CanonicalField[] = [
  "dealName",
  "amount",
  "stage",
  "closeDate",
  "owner",
  "lastActivity",
  "createdDate",
  "nextStep",
  "probability",
  "forecastCategory",
];

interface ColumnConfirmProps {
  headers: string[];
  rows: RawRow[];
  guesses: FieldGuess[];
  initialMapping: Mapping;
  initialLateStages?: string[];
  initialQuota?: number | null;
  crm?: CrmGuess;
  isSample: boolean;
  parseWarnings?: string[];
  defaultLateStages: string[];
  fileName: string;
  onBack: () => void;
  onRun: (mapping: Mapping, lateStages: string[], quota: number | null) => void;
}

export function ColumnConfirm({
  headers,
  rows,
  guesses,
  initialMapping,
  initialLateStages,
  initialQuota,
  crm,
  isSample,
  parseWarnings = [],
  defaultLateStages,
  fileName,
  onBack,
  onRun,
}: ColumnConfirmProps) {
  const [mapping, setMapping] = React.useState<Mapping>(initialMapping);
  const [quota, setQuota] = React.useState<string>(
    initialQuota != null ? String(initialQuota) : ""
  );
  const [showMapping, setShowMapping] = React.useState(!isSample);

  const guessByField = React.useMemo(
    () =>
      Object.fromEntries(guesses.map((g) => [g.field, g])) as Record<
        CanonicalField,
        FieldGuess
      >,
    [guesses]
  );

  const stageValues = React.useMemo(
    () => distinctStageValues(rows, mapping.stage),
    [rows, mapping.stage]
  );

  const [lateStages, setLateStages] = React.useState<Set<string>>(() => {
    if (initialLateStages) return new Set(initialLateStages);
    const set = new Set<string>();
    for (const v of distinctStageValues(rows, initialMapping.stage)) {
      if (defaultLateStages.includes(v.toLowerCase().trim())) set.add(v);
    }
    return set;
  });

  const prevStageHeader = React.useRef(mapping.stage);
  React.useEffect(() => {
    const stageChanged = prevStageHeader.current !== mapping.stage;
    prevStageHeader.current = mapping.stage;
    if (!stageChanged) {
      setLateStages((prev) =>
        new Set([...prev].filter((v) => stageValues.includes(v)))
      );
      return;
    }
    setLateStages((prev) => {
      const next = new Set<string>();
      for (const v of stageValues) {
        if (prev.has(v) || defaultLateStages.includes(v.toLowerCase().trim()))
          next.add(v);
      }
      return next;
    });
  }, [stageValues, defaultLateStages, mapping.stage]);

  const quotaValid = isValidQuotaInput(quota);
  const coreReady =
    !!mapping.dealName && !!mapping.amount && !!mapping.stage;
  const sampleReady = isSample && coreReady;

  const warnings: string[] = [...parseWarnings];
  if (!mapping.amount || !mapping.stage) {
    warnings.push(
      "Score will be limited — map Amount and Stage for a full diagnostic."
    );
  }
  if (mapping.stage && stageValues.length > 0 && lateStages.size === 0) {
    warnings.push(
      "Select at least one late/commit stage to run the late-stage + stale check."
    );
  }
  if (rows.length > 500) {
    warnings.push(
      `${rows.length} rows — large files may take a moment. Best for exports under ~500 open deals.`
    );
  }

  const handleRun = () => {
    if (!quotaValid) return;
    onRun(mapping, [...lateStages], parseQuotaInput(quota));
  };

  const setField = (field: CanonicalField, header: string | null) =>
    setMapping((m) => ({ ...m, [field]: header }));

  const toggleLate = (v: string) =>
    setLateStages((prev) => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Confirm the columns
          </h2>
          <p className="mt-1 text-sm text-muted">
            We mapped{" "}
            <span className="text-foreground font-mono">{fileName}</span> (
            {rows.length} rows). Fix anything wrong before running.
          </p>
          {crm?.crm && crm.confidence >= 0.5 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
              <CrmCheckIcon />
              Looks like a {CRM_LABEL[crm.crm]} export — defaults tuned to match
            </div>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={onBack} className="shrink-0">
          <RestartIcon />
          Start over
        </Button>
      </div>

      {isSample && (
        <div className="mt-5 rounded-xl border border-accent/40 bg-accent-dim/50 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-foreground">
              Mapping looks good — run the demo
            </p>
            <p className="text-xs text-muted mt-0.5">
              Pre-filled from the sample export. One click to see your score.
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleRun}
            disabled={!sampleReady || !quotaValid}
            className="shrink-0"
          >
            Run now →
          </Button>
        </div>
      )}

      {isSample && !showMapping && (
        <button
          type="button"
          onClick={() => setShowMapping(true)}
          className="mt-3 text-xs text-accent hover:underline cursor-pointer"
        >
          Review column mapping
        </button>
      )}

      {warnings.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {warnings.map((w) => (
            <div
              key={w}
              className="rounded-lg border border-warn/40 bg-warn/5 px-3 py-2 text-xs text-warn"
              role="status"
            >
              {w}
            </div>
          ))}
        </div>
      )}

      {(showMapping || !isSample) && (
        <>
          <div className="mt-6 rounded-xl border border-border bg-surface/60 divide-y divide-border">
            {FIELD_ORDER.map((field) => {
              const g = guessByField[field];
              const confident = g && g.confidence >= HIGH_CONFIDENCE;
              const current = mapping[field];
              return (
                <div key={field} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-36 shrink-0">
                    <div className="text-sm font-medium text-foreground">
                      {FIELD_LABELS[field]}
                    </div>
                    <div className="text-[11px] text-muted-2">
                      {current
                        ? confident
                          ? "auto-detected"
                          : "low confidence — check"
                        : "not mapped"}
                    </div>
                  </div>
                  <div className="flex-1">
                    <select
                      value={current ?? ""}
                      onChange={(e) =>
                        setField(field, e.target.value || null)
                      }
                      className={cn(
                        "w-full h-9 rounded-lg bg-surface-2 border px-3 text-sm text-foreground",
                        "outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                        current
                          ? confident
                            ? "border-good/40"
                            : "border-warn/50"
                          : "border-border-strong"
                      )}
                    >
                      <option value="">— not in this file —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-5 shrink-0 flex justify-center">
                    {current ? (
                      confident ? (
                        <CheckIcon className="text-good" />
                      ) : (
                        <AlertIcon className="text-warn" />
                      )
                    ) : (
                      <span className="text-muted-2 text-xs">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {mapping.stage && stageValues.length > 0 && (
            <div className="mt-5 rounded-xl border border-border bg-surface/60 px-4 py-4">
              <div className="text-sm font-medium text-foreground">
                Which stages count as late / commit?
              </div>
              <p className="text-[11px] text-muted-2 mt-0.5 mb-3">
                Powers the sharpest checks (late-stage deals gone quiet, weighted
                coverage). Defaults pre-selected.
              </p>
              <div className="flex flex-wrap gap-2">
                {stageValues.map((v) => {
                  const on = lateStages.has(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleLate(v)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs border transition-colors cursor-pointer",
                        on
                          ? "bg-accent/15 border-accent/60 text-foreground"
                          : "bg-surface-2 border-border-strong text-muted hover:text-foreground"
                      )}
                    >
                      {on ? "✓ " : ""}
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-border bg-surface/60 px-4 py-4">
            <label className="text-sm font-medium text-foreground" htmlFor="quota">
              Quota / target{" "}
              <span className="text-muted-2 font-normal">
                (optional — unlocks coverage scoring)
              </span>
            </label>
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-muted">$</span>
                <input
                  id="quota"
                  inputMode="numeric"
                  placeholder="e.g. 1000000"
                  value={quota}
                  onChange={(e) =>
                    setQuota(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  className={cn(
                    "h-9 w-48 rounded-lg bg-surface-2 border px-3 text-sm tnum outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                    quotaValid ? "border-border-strong" : "border-bad/50"
                  )}
                />
              </div>
              {!quotaValid && (
                <p className="text-xs text-bad" role="alert">
                  Enter a valid positive number, or leave blank.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {(!isSample || showMapping) && (
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button size="lg" onClick={handleRun} disabled={!quotaValid}>
            Run diagnostic →
          </Button>
        </div>
      )}
    </motion.div>
  );
}

function CrmCheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function RestartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 8v5m0 3h.01M12 3l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
