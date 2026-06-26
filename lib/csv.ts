// CSV parsing (PapaParse) and client-side annotated-CSV export.
// Everything here runs in the browser; no row data ever leaves the machine.

import Papa from "papaparse";
import type { AnnotatedRow, RawRow } from "./types";

export interface ParsedCsv {
  headers: string[];
  rows: RawRow[];
  /** Non-fatal issues worth surfacing in the confirm step. */
  warnings: string[];
}

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

const BOM = "\uFEFF";

/** Strip UTF-8 BOM and trim CRM export headers. */
export function normalizeHeader(h: string): string {
  return h.replace(/^\uFEFF/, "").trim();
}

function validateHeaders(headers: string[]): string[] {
  const warnings: string[] = [];
  const seen = new Map<string, number>();
  for (const h of headers) {
    const n = h.toLowerCase();
    seen.set(n, (seen.get(n) ?? 0) + 1);
  }
  const dupes = [...seen.entries()].filter(([, c]) => c > 1).map(([h]) => h);
  if (dupes.length) {
    warnings.push(
      `Duplicate column headers detected (${dupes.join(", ")}). Only the last value per row is kept — check your mapping.`
    );
  }
  return warnings;
}

function isFatalParseError(e: Papa.ParseError): boolean {
  if (e.type === "Delimiter") return false;
  if (e.message?.includes("auto-detect delimiting character")) return false;
  return true;
}

function finishParse(
  headers: string[],
  rows: RawRow[],
  errors: Papa.ParseError[]
): ParsedCsv {
  const fatal = errors.filter(isFatalParseError);
  if (fatal.length > 0) {
    const first = fatal[0];
    throw new CsvParseError(
      first.message || "Couldn't parse that CSV. Check the file format."
    );
  }
  const cleanHeaders = headers.filter((h) => h && h.trim() !== "");
  if (!cleanHeaders.length) {
    throw new CsvParseError("That file has no column headers.");
  }
  const warnings = validateHeaders(cleanHeaders);
  return { headers: cleanHeaders, rows, warnings };
}

/** Parse a File (drag-drop / picker) into headers + string rows. */
export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      delimiter: ",",
      transformHeader: normalizeHeader,
      complete: (res) => {
        try {
          resolve(
            finishParse(
              res.meta.fields ?? [],
              res.data as RawRow[],
              res.errors
            )
          );
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(new CsvParseError(err.message)),
    });
  });
}

/** Parse CSV text (used by the sample-data path and tests). */
export function parseCsvText(text: string): ParsedCsv {
  const res = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter: ",",
    transformHeader: normalizeHeader,
  });
  return finishParse(
    res.meta.fields ?? [],
    res.data as RawRow[],
    res.errors
  );
}

/** Serialize annotated rows back to a CSV string (original cols + appended). */
export function annotatedToCsv(
  originalHeaders: string[],
  rows: AnnotatedRow[]
): string {
  const appended = ["_RiskScore", "_Flags", "_Reasons"];
  const columns = [...originalHeaders, ...appended];
  return Papa.unparse(
    { fields: columns, data: rows.map((r) => columns.map((c) => r[c] ?? "")) },
    { quotes: true }
  );
}

/** Trigger a client-side download of a string as a file. */
export function downloadText(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Loose check before PapaParse — rejects obvious non-CSV uploads. */
export function isLikelyCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return true;
  const type = file.type.toLowerCase();
  return type === "text/csv" || type === "application/vnd.ms-excel" || type === "";
}
