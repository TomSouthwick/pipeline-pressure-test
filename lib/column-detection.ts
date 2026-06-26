// Two-layer column auto-detection: synonym dictionary, then content sniffer.
// Produces a confidence-scored guess per canonical field plus an initial
// Mapping. Real uploads show a confirm step before any result.

import type { CanonicalField, FieldGuess, Mapping, RawRow } from "./types";
import { DATE_FIELDS, HIGH_CONFIDENCE, SYNONYMS } from "./scoring-config";
import { looksLikeCurrency, looksLikeDate, looksLikeProbability } from "./parse";

const ALL_FIELDS: CanonicalField[] = [
  "dealName",
  "amount",
  "stage",
  "owner",
  "closeDate",
  "createdDate",
  "lastActivity",
  "nextStep",
  "probability",
  "forecastCategory",
];

/** Normalise a header for matching: lowercase, strip non-alphanumerics. */
function norm(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const NORM_SYNONYMS: Record<CanonicalField, Set<string>> = Object.fromEntries(
  (Object.keys(SYNONYMS) as CanonicalField[]).map((f) => [
    f,
    new Set(SYNONYMS[f].map(norm)),
  ])
) as Record<CanonicalField, Set<string>>;

/** Layer 1: synonym match. Returns confidence 0..1 for a header vs a field. */
function synonymScore(header: string, field: CanonicalField): number {
  const n = norm(header);
  if (n === "") return 0;
  const set = NORM_SYNONYMS[field];
  if (set.has(n)) return 1; // exact (normalised) synonym
  // Partial: a synonym is contained in the header or vice-versa.
  for (const syn of set) {
    if (n.includes(syn) || syn.includes(n)) return 0.75;
  }
  return 0;
}

interface ColumnProfile {
  header: string;
  dateShare: number;
  currencyShare: number;
  probShare: number;
  nonEmpty: number;
  cardinalityRatio: number; // distinct / nonEmpty
  avgLen: number;
}

function profileColumn(header: string, rows: RawRow[]): ColumnProfile {
  const sample = rows.slice(0, 200);
  let dates = 0;
  let currency = 0;
  let prob = 0;
  let nonEmpty = 0;
  let lenSum = 0;
  const distinct = new Set<string>();

  for (const row of sample) {
    const v = (row[header] ?? "").trim();
    if (v === "") continue;
    nonEmpty++;
    lenSum += v.length;
    distinct.add(v);
    if (looksLikeDate(v)) dates++;
    if (looksLikeCurrency(v)) currency++;
    if (looksLikeProbability(v)) prob++;
  }

  return {
    header,
    dateShare: nonEmpty ? dates / nonEmpty : 0,
    currencyShare: nonEmpty ? currency / nonEmpty : 0,
    probShare: nonEmpty ? prob / nonEmpty : 0,
    nonEmpty,
    cardinalityRatio: nonEmpty ? distinct.size / nonEmpty : 0,
    avgLen: nonEmpty ? lenSum / nonEmpty : 0,
  };
}

/** Layer 2: content sniff. Confidence 0..1 for a column matching a field. */
function contentScore(p: ColumnProfile, field: CanonicalField): number {
  if (p.nonEmpty === 0) return 0;

  if (DATE_FIELDS.includes(field)) {
    return p.dateShare > 0.6 ? 0.55 : 0;
  }
  if (field === "amount") {
    return p.currencyShare > 0.6 && p.dateShare < 0.3 ? 0.55 : 0;
  }
  if (field === "stage") {
    // Low-cardinality short strings, not dates/currency.
    return p.cardinalityRatio < 0.3 && p.avgLen < 30 && p.dateShare < 0.2
      ? 0.4
      : 0;
  }
  if (field === "owner") {
    // Low-ish cardinality, short-ish, name-like.
    return p.cardinalityRatio < 0.5 && p.avgLen < 40 && p.dateShare < 0.2
      ? 0.35
      : 0;
  }
  if (field === "dealName") {
    // High-cardinality free text.
    return p.cardinalityRatio > 0.7 && p.avgLen > 8 ? 0.35 : 0;
  }
  if (field === "probability") {
    // Percentages or 0..1 decimals. Bare integers are too ambiguous vs amount,
    // so looksLikeProbability only counts % / decimals — synonyms cover the rest.
    return p.probShare > 0.6 ? 0.5 : 0;
  }
  // forecastCategory: synonym-only. Its values (Commit/Best Case/Pipeline) look
  // like a generic low-cardinality enum and would steal the stage column.
  return 0;
}

export interface DetectionResult {
  guesses: FieldGuess[];
  mapping: Mapping;
}

/**
 * Run both detection layers over the parsed CSV and produce one best guess per
 * canonical field. Greedy assignment: each header used at most once, strongest
 * field claims it first.
 */
export function autoDetect(headers: string[], rows: RawRow[]): DetectionResult {
  const profiles = new Map(headers.map((h) => [h, profileColumn(h, rows)]));

  // Build all (field, header) candidate scores.
  type Cand = {
    field: CanonicalField;
    header: string;
    score: number;
    via: "synonym" | "content";
  };
  const candidates: Cand[] = [];

  for (const field of ALL_FIELDS) {
    for (const header of headers) {
      const syn = synonymScore(header, field);
      if (syn > 0) candidates.push({ field, header, score: syn, via: "synonym" });
      const content = contentScore(profiles.get(header)!, field);
      if (content > 0)
        candidates.push({ field, header, score: content, via: "content" });
    }
  }

  // Greedy: highest score first, one header per field, one field per header.
  candidates.sort((a, b) => b.score - a.score);
  const usedHeaders = new Set<string>();
  const claimed = new Map<CanonicalField, Cand>();

  for (const c of candidates) {
    if (claimed.has(c.field)) continue;
    if (usedHeaders.has(c.header)) continue;
    claimed.set(c.field, c);
    usedHeaders.add(c.header);
  }

  const guesses: FieldGuess[] = ALL_FIELDS.map((field) => {
    const c = claimed.get(field);
    return c
      ? { field, header: c.header, confidence: c.score, via: c.via }
      : { field, header: null, confidence: 0, via: "none" };
  });

  // Pre-fill every detected header; the UI uses confidence only to decide
  // whether a row shows as auto-confirmed vs. needs-a-look.
  const mapping = Object.fromEntries(
    guesses.map((g) => [g.field, g.header])
  ) as Mapping;

  return { guesses, mapping };
}

/** Distinct, trimmed, non-empty stage values present in the data. */
export function distinctStageValues(
  rows: RawRow[],
  stageHeader: string | null
): string[] {
  if (!stageHeader) return [];
  const set = new Set<string>();
  for (const row of rows) {
    const v = (row[stageHeader] ?? "").trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Stage values pre-selected as late/commit from CRM defaults. */
export function defaultLateStagesFor(
  rows: RawRow[],
  mapping: Mapping,
  defaultLateStages: string[]
): string[] {
  return distinctStageValues(rows, mapping.stage).filter((v) =>
    defaultLateStages.includes(v.toLowerCase().trim())
  );
}

export { HIGH_CONFIDENCE };
