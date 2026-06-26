"use client";

import { Button } from "@/components/ui/button";
import type { DiagnosticResult } from "@/lib/types";
import { annotatedToCsv, downloadText } from "@/lib/csv";
import { generatePdf } from "@/lib/pdf";

interface OutputsBarProps {
  result: DiagnosticResult;
  originalHeaders: string[];
  onReset: () => void;
}

export function OutputsBar({ result, originalHeaders, onReset }: OutputsBarProps) {
  const downloadCsv = () => {
    const csv = annotatedToCsv(originalHeaders, result.annotatedRows);
    downloadText("pipeline-annotated.csv", csv, "text/csv;charset=utf-8");
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" size="md" onClick={() => generatePdf(result)}>
        <FileIcon />
        Download PDF report
      </Button>
      <Button variant="secondary" size="md" onClick={downloadCsv}>
        <CsvIcon />
        Download annotated CSV
      </Button>
      <Button variant="ghost" size="md" className="ml-auto" onClick={onReset}>
        Analyse another file
      </Button>
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function CsvIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 4h16v16H4zM4 9h16M9 9v11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
