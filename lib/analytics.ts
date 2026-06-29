// Thin wrapper over Vercel Web Analytics custom events.
//
// Privacy contract: we only ever send anonymous, aggregate-friendly signals —
// never a user's pipeline data, deal names, amounts, or their actual score.
// Numbers are coarsened to buckets before they leave the browser. This keeps
// the product promise ("your pipeline data never leaves your browser") intact:
// these are usage pings, not data uploads.

import { track } from "@vercel/analytics";

export type CrmTag = "salesforce" | "hubspot" | "unknown";

/** Coarse 10-point bucket (e.g. 64 -> "60-69") so the raw score is never sent. */
export function scoreBucket(score: number | null | undefined): string {
  if (score == null) return "na";
  const lo = Math.max(0, Math.min(90, Math.floor(score / 10) * 10));
  return `${lo}-${lo + 9}`;
}

export { track };
