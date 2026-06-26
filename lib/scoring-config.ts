// ============================================================================
// scoring-config.ts — THE TUNABLE IP.
//
// Every threshold, weight, synonym, and stage map lives here so it can be
// refined with sales judgement without touching engine or UI code. The values
// below are a defensible v1, not gospel. Change numbers here, not logic there.
// ============================================================================

import type { CanonicalField } from "./types";

/** A detected guess at/above this confidence is pre-confirmed in the UI. */
export const HIGH_CONFIDENCE = 0.7;

// ---------------------------------------------------------------------------
// Layer 1 — synonym dictionary, keyed to real CRM export headers.
// Matching is done after normalising (lowercase, strip non-alphanumerics).
// ---------------------------------------------------------------------------
export const SYNONYMS: Record<CanonicalField, string[]> = {
  dealName: ["Deal Name", "Opportunity Name", "Name", "Opp Name", "Deal"],
  amount: [
    "Amount",
    "Deal Value",
    "ARR",
    "Value",
    "Opportunity Amount",
    "Deal Amount",
    "Total",
    "ACV",
    "MRR",
  ],
  stage: ["Stage", "Deal Stage", "Opportunity Stage", "Sales Stage", "Status"],
  owner: [
    "Owner",
    "Deal Owner",
    "Opportunity Owner",
    "Assigned To",
    "Account Owner",
    "Rep",
  ],
  closeDate: [
    "Close Date",
    "CloseDate",
    "Expected Close",
    "Close",
    "Est. Close Date",
    "Estimated Close Date",
    "Projected Close Date",
  ],
  createdDate: ["Created Date", "Create Date", "Created", "Date Created", "Open Date"],
  lastActivity: [
    "Last Activity",
    "Last Activity Date",
    "Last Contacted",
    "Last Touch",
    "Last Engagement",
  ],
  nextStep: ["Next Step", "Next Steps", "Next Activity", "Next Action"],
  probability: [
    // Salesforce
    "Probability (%)",
    "Probability",
    "Forecast Probability",
    "Win Probability",
    // HubSpot
    "Deal probability",
    "Probability to close",
    "Likelihood to close",
  ],
  forecastCategory: [
    // Salesforce
    "Forecast Category",
    "ForecastCategoryName",
    "Forecast Category Name",
    // HubSpot
    "Forecast category",
    "Deal forecast category",
  ],
};

/** Which fields are dates (drives the content sniffer + parsing). */
export const DATE_FIELDS: CanonicalField[] = [
  "closeDate",
  "createdDate",
  "lastActivity",
];

// ---------------------------------------------------------------------------
// Default late/commit stage names (Salesforce + HubSpot flavours). Used to
// pre-tick the late-stage selector; the user can override per export.
// ---------------------------------------------------------------------------
export const DEFAULT_LATE_STAGES = [
  // Salesforce-ish
  "Negotiation/Review",
  "Negotiation",
  "Proposal/Price Quote",
  "Proposal",
  "Contract Sent",
  "Commit",
  "Verbal",
  // HubSpot-ish
  "Decision Maker Bought-In",
  "Contract Sent",
  "Closed Won (pending)",
].map((s) => s.toLowerCase());

// ---------------------------------------------------------------------------
// Stage -> probability map for weighted pipeline. Keys are normalised
// (lowercase). The engine matches a deal's stage against these, falling back
// to a default when unknown.
// ---------------------------------------------------------------------------
export const STAGE_PROBABILITY: Record<string, number> = {
  // early
  prospecting: 0.1,
  qualification: 0.15,
  "qualified to buy": 0.2,
  discovery: 0.2,
  "needs analysis": 0.25,
  "appointment scheduled": 0.15,
  // mid
  "value proposition": 0.35,
  "id. decision makers": 0.4,
  "decision maker bought-in": 0.6,
  "perception analysis": 0.45,
  // late
  proposal: 0.6,
  "proposal/price quote": 0.65,
  "contract sent": 0.8,
  negotiation: 0.75,
  "negotiation/review": 0.8,
  commit: 0.85,
  verbal: 0.9,
};
export const DEFAULT_STAGE_PROBABILITY = 0.3;

// ---------------------------------------------------------------------------
// Per-flag weights. These feed BOTH the per-deal risk ranking and the
// category scoring (a category's score = 25 minus its weighted penalty share).
// Higher weight = more damaging.
// ---------------------------------------------------------------------------
export const WEIGHTS = {
  // Hygiene
  missingAmount: 3,
  missingCloseDate: 3,
  overdue: 4,
  missingOwner: 2,
  missingNextStep: 1,

  // Momentum
  stale14: 1,
  stale30: 2,
  stale60: 4,
  stuck: 3,
  zombie: 3,

  // Concentration & risk (per-deal contributor)
  lateStageStale: 6, // highest individual weight — the sharp one
} as const;

// ---------------------------------------------------------------------------
// Momentum thresholds (days).
// ---------------------------------------------------------------------------
export const MOMENTUM = {
  stale: { tier1: 14, tier2: 30, tier3: 60 },
  stuckEarlyDays: 30,
  stuckLateDays: 21,
  zombieAgeDays: 90,
};

// ---------------------------------------------------------------------------
// Concentration & risk thresholds (portfolio-level).
// ---------------------------------------------------------------------------
export const CONCENTRATION = {
  /** Flag if > this share of pipeline value closes in the final 7 days of qtr. */
  bunchingShare: 0.4,
  bunchingWindowDays: 7,
  /** Flag if top 3 deals are > this share of total open value. */
  top3Share: 0.5,
  /** Days of no activity that makes a late-stage deal "stale". */
  lateStageStaleDays: 30,
};

// ---------------------------------------------------------------------------
// Coverage & realism thresholds (only when a quota is provided).
// ---------------------------------------------------------------------------
export const COVERAGE = {
  /** Healthy raw coverage multiple. Flag below this. */
  minCoverageRatio: 3,
  /** Healthy weighted coverage multiple. Flag below this. */
  minWeightedRatio: 1,
};

// ---------------------------------------------------------------------------
// Category weighting. Each is out of 25 -> 100 total. When Coverage is
// skipped (no quota), the remaining three are rescaled to 100.
// ---------------------------------------------------------------------------
export const CATEGORY_MAX = 25;

// ---------------------------------------------------------------------------
// How many worst deals to surface.
// ---------------------------------------------------------------------------
export const WORST_DEALS_COUNT = 5;
export const WORST_DEALS_MIN = 3;

// ---------------------------------------------------------------------------
// Status thresholds for traffic lights, expressed as share-of-max (0..1).
// ---------------------------------------------------------------------------
export const STATUS_THRESHOLDS = {
  good: 0.75, // >= 75% of max -> green
  warn: 0.5, // >= 50% -> amber, else red
};

/** Map an overall 0..100 score to a short grade label for the headline. */
export function gradeFor(score: number): string {
  if (score >= 85) return "Healthy";
  if (score >= 70) return "Solid, with leaks";
  if (score >= 55) return "Shaky";
  if (score >= 40) return "At risk";
  return "Critical";
}
