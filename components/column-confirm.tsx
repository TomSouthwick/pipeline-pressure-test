"use client";

import * as React from "react";
import {
  motion,
  useAnimationControls,
  useReducedMotion,
} from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { CanonicalField, FieldGuess, Mapping } from "@/lib/types";
import { HIGH_CONFIDENCE } from "@/lib/scoring-config";
import {
  defaultLateStagesFor,
  distinctStageValues,
} from "@/lib/column-detection";
import { CRM_LABEL, type CrmGuess } from "@/lib/crm-detection";
import { isValidQuotaInput, parseQuotaInput, checkDateFormat } from "@/lib/parse";
import { getPeriodBounds } from "@/lib/quota-period";
import type { QuotaPeriod, RawRow } from "@/lib/types";

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

const REQUIRED_FIELDS: CanonicalField[] = ["dealName", "amount", "stage"];

function formatMissingRequiredFields(missing: CanonicalField[]): string {
  const labels = missing.map((f) => FIELD_LABELS[f]);
  if (labels.length === 1) return `Map ${labels[0]} to run`;
  if (labels.length === 2) return `Map ${labels[0]} and ${labels[1]} to run`;
  return `Map ${labels[0]}, ${labels[1]}, and ${labels[2]} to run`;
}

const OPTIONAL_FIELDS: CanonicalField[] = [
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
  initialQuotaPeriod?: QuotaPeriod;
  crm?: CrmGuess;
  isSample: boolean;
  parseWarnings?: string[];
  defaultLateStages: string[];
  fileName: string;
  onBack: () => void;
  onRun: (
    mapping: Mapping,
    lateStages: string[],
    quota: number | null,
    quotaPeriod: QuotaPeriod
  ) => void;
}

function fieldSortPriority(
  field: CanonicalField,
  mapping: Mapping,
  guessByField: Record<CanonicalField, FieldGuess>
): number {
  const current = mapping[field];
  if (!current) return 0;
  const g = guessByField[field];
  if (g && g.confidence >= HIGH_CONFIDENCE) return 2;
  return 1;
}

export function ColumnConfirm({
  headers,
  rows,
  guesses,
  initialMapping,
  initialLateStages,
  initialQuota,
  initialQuotaPeriod,
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
  const [quotaPeriod, setQuotaPeriod] = React.useState<QuotaPeriod>(
    initialQuotaPeriod ?? "quarter"
  );

  const periodLabels = React.useMemo(() => {
    const now = new Date();
    return {
      quarter: getPeriodBounds("quarter", now).label,
      year: getPeriodBounds("year", now).label,
    };
  }, []);

  const guessByField = React.useMemo(
    () =>
      Object.fromEntries(guesses.map((g) => [g.field, g])) as Record<
        CanonicalField,
        FieldGuess
      >,
    [guesses]
  );

  const mappedFields = React.useMemo(() => {
    const optionalSorted = [...OPTIONAL_FIELDS].sort(
      (a, b) =>
        fieldSortPriority(a, mapping, guessByField) -
        fieldSortPriority(b, mapping, guessByField)
    );
    return [...REQUIRED_FIELDS, ...optionalSorted];
  }, [mapping, guessByField]);

  const stageValues = React.useMemo(
    () => distinctStageValues(rows, mapping.stage),
    [rows, mapping.stage]
  );

  const [lateStages, setLateStages] = React.useState<Set<string>>(() => {
    if (initialLateStages) return new Set(initialLateStages);
    return new Set(
      defaultLateStagesFor(rows, initialMapping, defaultLateStages)
    );
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
  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  const requiredMappedCount = REQUIRED_FIELDS.filter((f) => !!mapping[f]).length;

  const dateCheck = React.useMemo(
    () =>
      mapping.closeDate
        ? checkDateFormat(rows.map((r) => r[mapping.closeDate!]))
        : { ambiguous: false, sample: null, interpreted: null },
    [rows, mapping.closeDate]
  );

  const warnings: string[] = [...parseWarnings];
  if (dateCheck.ambiguous && dateCheck.sample && dateCheck.interpreted) {
    warnings.push(
      `Close dates like “${dateCheck.sample}” are ambiguous — we read them as ${dateCheck.interpreted} (US month/day). If your export is day/month, the dates are off.`
    );
  }
  if (!isSample && (!mapping.amount || !mapping.stage)) {
    warnings.push(
      "Score will be limited. Map amount and stage for a full result."
    );
  }
  if (mapping.stage && stageValues.length > 0 && lateStages.size === 0) {
    warnings.push(
      "Select at least one late or commit stage for the stale-deal check."
    );
  }
  if (rows.length > 500) {
    warnings.push(
      `${rows.length} rows. Large files may take a moment. Best under ~500 open deals.`
    );
  }

  const [shakeAttempt, setShakeAttempt] = React.useState(0);
  const reduceMotion = useReducedMotion();
  const requiredRowRefs = React.useRef<
    Partial<Record<CanonicalField, HTMLDivElement | null>>
  >({});

  const handleRun = () => {
    if (!quotaValid) return;
    if (!coreReady) {
      setShakeAttempt((n) => n + 1);
      const firstUnmapped = REQUIRED_FIELDS.find((f) => !mapping[f]);
      const rowEl = firstUnmapped
        ? requiredRowRefs.current[firstUnmapped]
        : null;
      if (rowEl) {
        rowEl.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "center",
        });
        rowEl.querySelector<HTMLSelectElement>("select")?.focus();
      }
      return;
    }
    onRun(mapping, [...lateStages], parseQuotaInput(quota), quotaPeriod);
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
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-2xl mx-auto pb-20"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-xl font-semibold tracking-tight">
                {isSample ? "Column mapping" : "Confirm the columns"}
              </h2>
              {crm?.crm && crm.confidence >= 0.5 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  <CrmCheckIcon />
                  {CRM_LABEL[crm.crm]}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {isSample
                ? `Sample export, ${rows.length} rows. Adjust if needed, then run.`
                : `${fileName}, ${rows.length} rows. Fix mapping, then run.`}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            className="shrink-0"
          >
            <RestartIcon />
            Start over
          </Button>
        </div>

        {warnings.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {warnings.map((w, i) => (
              <div
                key={`warn-${i}`}
                className="rounded-lg border border-warn/40 bg-warn/5 px-3 py-2 text-sm text-warn"
                role="status"
              >
                {w}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-border bg-surface/60 px-4 py-4">
          <p className="text-base font-medium text-foreground">Scoring options</p>
          <p className="text-sm text-muted mt-0.5 mb-4">
            Optional. Unlocks coverage and extra checks.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="text-base font-medium text-foreground">
                  {quotaPeriod === "quarter" ? "Quarterly target" : "Annual target"}
                </span>
                <div
                  className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5"
                  role="group"
                  aria-label="Target period"
                >
                  {(["quarter", "year"] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setQuotaPeriod(period)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                        quotaPeriod === period
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted hover:text-foreground"
                      )}
                    >
                      {period === "quarter" ? "Quarterly" : "Yearly"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted mt-0.5 mb-2">
                {quotaPeriod === "quarter"
                  ? `Compared to open pipeline closing this quarter (${periodLabels.quarter}).`
                  : `Compared to open pipeline closing this year (${periodLabels.year}).`}
              </p>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted">$</span>
                  <input
                    id="quota"
                    inputMode="numeric"
                    placeholder={
                      quotaPeriod === "quarter"
                        ? "e.g. 500000 for Q3"
                        : "e.g. 2000000 for 2026"
                    }
                    value={quota}
                    onChange={(e) =>
                      setQuota(e.target.value.replace(/[^0-9.]/g, ""))
                    }
                    className={cn(
                      "h-9 w-full max-w-48 rounded-lg bg-surface-2 border px-3 text-sm tnum outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                      quotaValid ? "border-border-strong" : "border-bad/50"
                    )}
                  />
                </div>
                {!quotaValid && (
                  <p className="text-sm text-bad" role="alert">
                    Enter a valid positive number, or leave blank.
                  </p>
                )}
              </div>
            </div>

            {mapping.stage && stageValues.length > 0 ? (
              <div>
                <div className="text-base font-medium text-foreground">
                  Late / commit stages
                </div>
                <p className="text-sm text-muted mt-0.5 mb-2">
                  Which stages are late or commit? Defaults pre-selected.
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
            ) : (
              <div className="text-sm text-muted sm:flex sm:items-end sm:pb-1">
                Map stage below to set late and commit stages.
              </div>
            )}
          </div>
        </div>

        <MappingSection
          title="Mapped columns"
          subtitle="Match your CSV headers. Deal name, amount, and stage are required."
          fields={mappedFields}
          headers={headers}
          mapping={mapping}
          guessByField={guessByField}
          onSetField={setField}
          shakeAttempt={shakeAttempt}
          requiredRowRefs={requiredRowRefs}
        />
      </motion.div>

      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
          <div className="min-w-0 text-sm text-muted">
            {coreReady ? (
              <span>
                <span className="tnum font-medium text-foreground">
                  {rows.length}
                </span>{" "}
                deals ·{" "}
                <span className="tnum font-medium text-foreground">
                  {requiredMappedCount}/3
                </span>{" "}
                required mapped
                <span className="hidden sm:inline text-muted-2">
                  {" "}
                  · {REQUIRED_FIELDS.map((f) => FIELD_LABELS[f]).join(", ")}
                </span>
              </span>
            ) : (
              <span className="text-warn font-medium">
                {formatMissingRequiredFields(missingRequired)}
              </span>
            )}
          </div>
          <Button
            size="lg"
            onClick={handleRun}
            disabled={!quotaValid}
            aria-disabled={!coreReady || !quotaValid}
            className={cn("shrink-0", !coreReady && quotaValid && "opacity-40")}
          >
            {isSample ? "Run now →" : "Run diagnostic →"}
          </Button>
        </div>
      </div>
    </>
  );
}

function MappingSection({
  title,
  subtitle,
  fields,
  headers,
  mapping,
  guessByField,
  onSetField,
  shakeAttempt,
  requiredRowRefs,
  className,
}: {
  title: string;
  subtitle: string;
  fields: CanonicalField[];
  headers: string[];
  mapping: Mapping;
  guessByField: Record<CanonicalField, FieldGuess>;
  onSetField: (field: CanonicalField, header: string | null) => void;
  shakeAttempt: number;
  requiredRowRefs: React.MutableRefObject<
    Partial<Record<CanonicalField, HTMLDivElement | null>>
  >;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-5 rounded-xl border border-border bg-surface/60 overflow-hidden",
        className
      )}
    >
      <div className="px-4 py-3 border-b border-border bg-surface/80">
        <p className="text-base font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted mt-0.5">{subtitle}</p>
      </div>
      <div>
        {fields.map((field, index) => (
          <MappingRow
            key={field}
            field={field}
            headers={headers}
            mapping={mapping}
            guess={guessByField[field]}
            onSetField={onSetField}
            isRequired={REQUIRED_FIELDS.includes(field)}
            shakeAttempt={shakeAttempt}
            showTopRule={
              index > 0 && !REQUIRED_FIELDS.includes(field)
            }
            rowRef={
              REQUIRED_FIELDS.includes(field)
                ? (el) => {
                    requiredRowRefs.current[field] = el;
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function MappingRow({
  field,
  headers,
  mapping,
  guess,
  onSetField,
  isRequired = false,
  shakeAttempt = 0,
  showTopRule = false,
  rowRef,
}: {
  field: CanonicalField;
  headers: string[];
  mapping: Mapping;
  guess?: FieldGuess;
  onSetField: (field: CanonicalField, header: string | null) => void;
  isRequired?: boolean;
  shakeAttempt?: number;
  showTopRule?: boolean;
  rowRef?: (el: HTMLDivElement | null) => void;
}) {
  const confident = guess && guess.confidence >= HIGH_CONFIDENCE;
  const current = mapping[field];
  const reduceMotion = useReducedMotion();
  const shakeControls = useAnimationControls();
  const unmappedRequired = isRequired && !current;

  React.useEffect(() => {
    if (shakeAttempt === 0 || !unmappedRequired || reduceMotion) return;
    void shakeControls.start({
      x: [0, -7, 7, -5, 5, -3, 3, 0],
      transition: { duration: 0.42, ease: "easeInOut" },
    });
  }, [shakeAttempt, unmappedRequired, reduceMotion, shakeControls]);

  const row = (
    <div className="flex items-center gap-3">
      <div className="w-32 sm:w-36 shrink-0">
        <div className="text-sm font-medium text-foreground">
          {FIELD_LABELS[field]}
        </div>
        <div className="text-xs text-muted-2">
          {current
            ? confident
              ? "Auto-detected"
              : "Low confidence, check this"
            : isRequired
              ? "Pick a column to run"
              : "Not mapped"}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <select
          value={current ?? ""}
          onChange={(e) => onSetField(field, e.target.value || null)}
          className={cn(
            "w-full h-9 rounded-lg bg-surface-2 border px-3 text-sm text-foreground",
            "outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
            current
              ? confident
                ? "border-good/40"
                : "border-warn/50"
              : isRequired
                ? "border-warn/35"
                : "border-border-strong"
          )}
        >
          <option value="">Not in this file</option>
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
        ) : null}
      </div>
    </div>
  );

  const rowClass = cn(
    "px-4 py-3",
    showTopRule && "border-t border-border",
    unmappedRequired && "bg-bad/8"
  );

  if (unmappedRequired && !reduceMotion) {
    return (
      <div ref={rowRef} className={rowClass}>
        <motion.div animate={shakeControls}>{row}</motion.div>
      </div>
    );
  }

  return (
    <div ref={rowRef} className={rowClass}>
      {row}
    </div>
  );
}

function CrmCheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 12.5l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function RestartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12a9 9 0 1 0 3-6.7L3 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 4v4h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M12 8v5m0 3h.01M12 3l9 16H3l9-16z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
