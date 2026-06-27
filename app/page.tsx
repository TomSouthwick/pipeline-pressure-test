"use client";

import * as React from "react";
import { AnimatePresence } from "motion/react";
import { Hero } from "@/components/hero";
import { SiteHeader } from "@/components/site-header";
import { ColumnConfirm } from "@/components/column-confirm";
import { ResultReveal } from "@/components/result-reveal";
import {
  parseCsvFile,
  parseCsvText,
  type ParsedCsv,
  CsvParseError,
  isLikelyCsvFile,
} from "@/lib/csv";
import { autoDetect } from "@/lib/column-detection";
import { inferCrm, type CrmGuess } from "@/lib/crm-detection";
import { runDiagnostic } from "@/lib/scoring-engine";
import { DEFAULT_LATE_STAGES } from "@/lib/scoring-config";
import { cn } from "@/lib/cn";
import type {
  DiagnosticResult,
  FieldGuess,
  Mapping,
  QuotaPeriod,
} from "@/lib/types";

interface ConfirmCtx {
  parsed: ParsedCsv;
  guesses: FieldGuess[];
  mapping: Mapping;
  fileName: string;
  crm: CrmGuess;
  isSample: boolean;
  parseWarnings: string[];
  lateStages?: string[];
  quota?: number | null;
  quotaPeriod?: QuotaPeriod;
}

type Stage =
  | { name: "idle" }
  | ({ name: "confirm" } & ConfirmCtx)
  | {
      name: "result";
      result: DiagnosticResult;
      headers: string[];
      mapping: Mapping;
      from: ConfirmCtx;
    };

export default function Home() {
  const [stage, setStage] = React.useState<Stage>({ name: "idle" });
  const [error, setError] = React.useState<string | null>(null);

  const ingest = React.useCallback(
    (
      parsed: ParsedCsv,
      fileName: string,
      isSample: boolean,
      prefill?: { quota?: number; quotaPeriod?: QuotaPeriod }
    ) => {
      if (!parsed.rows.length || !parsed.headers.length) {
        setError("That file has no readable rows. Is it a valid CSV export?");
        return;
      }
      setError(null);
      const { guesses, mapping } = autoDetect(parsed.headers, parsed.rows);
      const crm = inferCrm(parsed.headers);
      const ctx: ConfirmCtx = {
        parsed,
        guesses,
        mapping,
        fileName,
        crm,
        isSample,
        parseWarnings: parsed.warnings,
        quota: prefill?.quota,
        quotaPeriod: prefill?.quotaPeriod,
      };

      setStage({ name: "confirm", ...ctx });
    },
    []
  );

  const onFile = React.useCallback(
    async (file: File) => {
      if (!isLikelyCsvFile(file)) {
        setError("Please upload a CSV file (.csv).");
        return;
      }
      try {
        const parsed = await parseCsvFile(file);
        ingest(parsed, file.name, false);
      } catch (e) {
        setError(
          e instanceof CsvParseError
            ? e.message
            : "Couldn't parse that file. Please upload a CSV."
        );
      }
    },
    [ingest]
  );

  const loadSample = React.useCallback(
    async (
      path: string,
      fileName: string,
      prefill?: { quota?: number; quotaPeriod?: QuotaPeriod }
    ) => {
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error("fetch failed");
        const text = await res.text();
        ingest(parseCsvText(text), fileName, true, prefill);
      } catch {
        setError("Couldn't load the sample data.");
      }
    },
    [ingest]
  );

  const onSampleSalesforce = React.useCallback(
    () => loadSample("/sample-pipeline.csv", "sample-pipeline.csv"),
    [loadSample]
  );

  // The HubSpot sample pre-fills a quarterly target so Coverage runs out of the
  // box — showcasing CRM-probability-weighted pipeline alongside the Salesforce
  // sample, which stays a three-category (no-quota) story.
  const onSampleHubspot = React.useCallback(
    () =>
      loadSample(
        "/sample-pipeline-hubspot.csv",
        "sample-pipeline-hubspot.csv",
        { quota: 800_000, quotaPeriod: "quarter" }
      ),
    [loadSample]
  );

  const onRun = React.useCallback(
    (
      mapping: Mapping,
      lateStages: string[],
      quota: number | null,
      quotaPeriod: QuotaPeriod
    ) => {
      if (stage.name !== "confirm") return;
      const result = runDiagnostic(stage.parsed.rows, mapping, {
        lateStages,
        quota,
        quotaPeriod,
      });
      setStage({
        name: "result",
        result,
        headers: stage.parsed.headers,
        mapping,
        from: {
          parsed: stage.parsed,
          guesses: stage.guesses,
          mapping,
          fileName: stage.fileName,
          crm: stage.crm,
          isSample: stage.isSample,
          parseWarnings: stage.parseWarnings,
          lateStages,
          quota,
          quotaPeriod,
        },
      });
    },
    [stage]
  );

  const backToConfig = React.useCallback(() => {
    if (stage.name !== "result") return;
    setError(null);
    setStage({ name: "confirm", ...stage.from });
  }, [stage]);

  const reset = React.useCallback(() => {
    setError(null);
    setStage({ name: "idle" });
  }, []);

  return (
    <>
      <SiteHeader onHome={reset} />
      <main
        className={cn(
          "flex-1 flex flex-col items-center px-5 pt-5 pb-12 sm:pt-6 sm:pb-16",
          stage.name === "idle" ? "justify-center" : "justify-start"
        )}
      >
      <div className="w-full">
        <AnimatePresence mode="wait">
          {stage.name === "idle" && (
            <Hero
              key="idle"
              onFile={onFile}
              onSampleSalesforce={onSampleSalesforce}
              onSampleHubspot={onSampleHubspot}
              error={error}
            />
          )}
          {stage.name === "confirm" && (
            <ColumnConfirm
              key="confirm"
              headers={stage.parsed.headers}
              rows={stage.parsed.rows}
              guesses={stage.guesses}
              initialMapping={stage.mapping}
              initialLateStages={stage.lateStages}
              initialQuota={stage.quota}
              initialQuotaPeriod={stage.quotaPeriod}
              crm={stage.crm}
              isSample={stage.isSample}
              parseWarnings={stage.parseWarnings}
              defaultLateStages={DEFAULT_LATE_STAGES}
              fileName={stage.fileName}
              onBack={reset}
              onRun={onRun}
            />
          )}
          {stage.name === "result" && (
            <ResultReveal
              key="result"
              result={stage.result}
              mapping={stage.mapping}
              originalHeaders={stage.headers}
              isSample={stage.from.isSample}
              crm={stage.from.crm}
              onBack={backToConfig}
              onReset={reset}
            />
          )}
        </AnimatePresence>
      </div>

      {stage.name === "idle" && (
        <footer className="mt-16 flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Runs in your browser. Nothing is uploaded.
          </div>
        </footer>
      )}
    </main>
    </>
  );
}
