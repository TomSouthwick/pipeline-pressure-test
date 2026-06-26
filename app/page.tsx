"use client";

import * as React from "react";
import { AnimatePresence } from "motion/react";
import { Hero } from "@/components/hero";
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
import type {
  DiagnosticResult,
  FieldGuess,
  Mapping,
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
    (parsed: ParsedCsv, fileName: string, isSample: boolean) => {
      if (!parsed.rows.length || !parsed.headers.length) {
        setError("That file has no readable rows. Is it a valid CSV export?");
        return;
      }
      setError(null);
      const { guesses, mapping } = autoDetect(parsed.headers, parsed.rows);
      const crm = inferCrm(parsed.headers);
      setStage({
        name: "confirm",
        parsed,
        guesses,
        mapping,
        fileName,
        crm,
        isSample,
        parseWarnings: parsed.warnings,
      });
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
    async (path: string, fileName: string) => {
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error("fetch failed");
        const text = await res.text();
        ingest(parseCsvText(text), fileName, true);
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

  const onSampleHubspot = React.useCallback(
    () =>
      loadSample(
        "/sample-pipeline-hubspot.csv",
        "sample-pipeline-hubspot.csv"
      ),
    [loadSample]
  );

  const onRun = React.useCallback(
    (mapping: Mapping, lateStages: string[], quota: number | null) => {
      if (stage.name !== "confirm") return;
      const result = runDiagnostic(stage.parsed.rows, mapping, {
        lateStages,
        quota,
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
    <main className="flex-1 flex flex-col items-center justify-center px-5 py-12 sm:py-16">
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
              onBack={backToConfig}
              onReset={reset}
            />
          )}
        </AnimatePresence>
      </div>

      <footer className="mt-16 flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs text-muted">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Runs entirely in your browser — no data is uploaded or stored
        </div>
        <span className="text-[10px] text-muted-2">v0</span>
      </footer>
    </main>
  );
}
