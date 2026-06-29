// Tolerant value parsing shared by detection and the engine.
// CRM exports are messy: "$1,200", "1.2k", "12/31/2025", "2025-12-31", "".

/** Parse a currency/number cell. Returns null when not numeric. */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === "") return null;

  // Strip currency symbols, commas, spaces.
  s = s.replace(/[$£€¥,\s]/g, "");

  // Handle k / m / b suffixes (e.g. "1.2k", "3M").
  const suffix = s.slice(-1).toLowerCase();
  const mult =
    suffix === "k" ? 1e3 : suffix === "m" ? 1e6 : suffix === "b" ? 1e9 : 1;
  if (mult !== 1) s = s.slice(0, -1);

  // Parenthesised negatives: (500) -> -500
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }

  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s) * mult * sign;
  return Number.isFinite(n) ? n : null;
}

/** Parse a date cell into a Date, or null. Handles common CRM formats. */
export function parseDate(raw: string | null | undefined): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;

  // ISO-ish: 2025-12-31 or 2025-12-31T... — trust Date.
  if (/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(s)) {
    const d = new Date(s);
    return isValidDate(d) ? d : null;
  }

  // M/D/Y or D/M/Y with / or - or . separators.
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    let year = parseInt(y, 10);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    // Assume US M/D/Y (dominant in Salesforce/HubSpot US exports). If the
    // first part can't be a month but the second can, swap.
    let month = parseInt(a, 10);
    let day = parseInt(b, 10);
    if (month > 12 && day <= 12) {
      [month, day] = [day, month];
    }
    const d = new Date(year, month - 1, day);
    return isValidDate(d) ? d : null;
  }

  // Fallback: let the engine try native parsing (e.g. "Dec 31, 2025").
  const d = new Date(s);
  return isValidDate(d) ? d : null;
}

function isValidDate(d: Date): boolean {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export interface DateFormatCheck {
  /** True when numeric D/M vs M/D can't be told apart and we may be guessing wrong. */
  ambiguous: boolean;
  /** An example raw value from the column, for the hint. */
  sample: string | null;
  /** How parseDate interpreted that sample (long form), for the hint. */
  interpreted: string | null;
}

/**
 * Inspect a date column for the classic D/M vs M/D trap. parseDate() assumes US
 * M/D and only swaps when the first part exceeds 12 — so a UK "06/04/2026" is
 * silently read as 4 June. This flags when that guess is unverifiable so the
 * confirm step can show the user how we read it.
 */
export function checkDateFormat(values: (string | null | undefined)[]): DateFormatCheck {
  const none: DateFormatCheck = { ambiguous: false, sample: null, interpreted: null };
  const slash = /^(\d{1,2})[/\-.](\d{1,2})[/\-.]\d{2,4}$/;

  let monthFirstEvidence = false; // second part > 12 => definitely M/D
  let dayFirstEvidence = false; // first part > 12 => definitely D/M
  let undetermined: string | null = null; // both parts <= 12
  let firstSlash: string | null = null;

  for (const raw of values) {
    if (raw == null) continue;
    const s = String(raw).trim();
    const m = s.match(slash);
    if (!m) continue;
    if (firstSlash == null) firstSlash = s;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (b > 12 && a <= 12) monthFirstEvidence = true;
    else if (a > 12 && b <= 12) dayFirstEvidence = true;
    else if (a <= 12 && b <= 12 && undetermined == null) undetermined = s;
  }

  if (firstSlash == null) return none; // no numeric slash dates -> unambiguous
  if (monthFirstEvidence) return none; // data confirms M/D, our default is right

  // No M/D evidence, but either explicit day-first dates or unguessable ones
  // exist -> our M/D default may be wrong for the unguessable rows.
  if (!dayFirstEvidence && undetermined == null) return none;

  const sample = undetermined ?? firstSlash;
  const d = parseDate(sample);
  const interpreted = d
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  return { ambiguous: true, sample, interpreted };
}

/**
 * Parse a probability cell into a 0..1 fraction, or null.
 * Handles "75%", "75", "0.75". Bare numbers > 1 are treated as percentages.
 */
export function parseProbability(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === "") return null;
  const hadPct = s.includes("%");
  s = s.replace(/%/g, "").replace(/,/g, "").trim();
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  let n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (hadPct) n = n / 100;
  else if (n > 1) n = n / 100; // "75" -> 0.75
  if (n < 0) return null;
  return Math.min(1, n);
}

/** Heuristic: does this string look like a probability (percentage or 0..1)? */
export function looksLikeProbability(raw: string): boolean {
  const s = raw.trim();
  if (s === "") return false;
  if (s.includes("%")) {
    const n = parseFloat(s.replace(/%/g, ""));
    return Number.isFinite(n) && n >= 0 && n <= 100;
  }
  // Bare decimal in 0..1 (e.g. "0.75"). Bare integers are too ambiguous vs
  // amount, so we leave those to the synonym layer.
  return /^0?\.\d+$/.test(s);
}

/** Heuristic: does this string look like a date? */
export function looksLikeDate(raw: string): boolean {
  const s = raw.trim();
  if (s === "") return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(s)) return true;
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(s)) return true; // Dec 31, 2025
  return false;
}

/** Heuristic: does this string look like a currency/number value? */
export function looksLikeCurrency(raw: string): boolean {
  const s = raw.trim();
  if (s === "") return false;
  if (looksLikeDate(s)) return false;
  return /^[($£€¥]?-?[\d,]+(\.\d+)?[kmbKMB)]?$/.test(s);
}

/** Days between two dates (a - b), rounded down. Positive if a is later. */
export function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

/** Parse optional quota input from the confirm step. Returns null when empty/invalid. */
export function parseQuotaInput(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  // Reject partial numeric strings like "12abc" that Number() would truncate.
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** True when quota field is empty or a valid positive number. */
export function isValidQuotaInput(raw: string): boolean {
  const s = raw.trim();
  if (!s) return true;
  if (!/^\d+(\.\d+)?$/.test(s)) return false;
  const n = Number(s);
  return Number.isFinite(n) && n > 0;
}
