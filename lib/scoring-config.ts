// ============================================================================
// scoring-config.ts — THE TUNABLE IP.
//
// Every threshold, weight, synonym, and stage map lives here so it can be
// refined with sales judgement without touching engine or UI code. The values
// below are a defensible v1, not gospel. Change numbers here, not logic there.
// ============================================================================

import type { CanonicalField, Status } from "./types";

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
// Per-deal risk tiers. A deal's risk score is the sum of its flag weights
// (see buildRankedDeal). These thresholds turn that raw number into a
// human-readable severity tier shown in the deal lists. Tunable.
// ---------------------------------------------------------------------------
export const RISK_TIERS = {
  /** >= this score is Critical (one late-stage-stale flag alone qualifies). */
  critical: WEIGHTS.lateStageStale, // 6
  /** >= this score (and below critical) is At risk. Below it is Watch. */
  atRisk: 3,
} as const;

// ---------------------------------------------------------------------------
// Per-flag metadata for the deal detail UI: a short label + point value for
// the risk breakdown, and a one-line "why it matters" interpretation. This is
// insight, not instruction — we explain why a flag is a forecast risk, we do
// not prescribe what to do about it.
// ---------------------------------------------------------------------------
export const FLAG_META: Record<
  string,
  { label: string; points: number; insight: string }
> = {
  late_stage_stale: {
    label: "late-stage stale",
    points: WEIGHTS.lateStageStale,
    insight:
      "Late-stage deals that go quiet are the most common source of slipped commits — the sharpest forecast-risk signal we track.",
  },
  overdue: {
    label: "overdue",
    points: WEIGHTS.overdue,
    insight:
      "The close date has already passed, so the forecast date is stale and no longer trustworthy.",
  },
  stale_60: {
    label: "stale 60+ days",
    points: WEIGHTS.stale60,
    insight: "Two months without activity usually means the deal has cooled.",
  },
  stale_30: {
    label: "stale 30–60 days",
    points: WEIGHTS.stale30,
    insight: "A month of silence is an early sign the deal is drifting.",
  },
  stale_14: {
    label: "stale 14+ days",
    points: WEIGHTS.stale14,
    insight: "Activity has paused — an early nudge keeps it from stalling.",
  },
  zombie: {
    label: "zombie",
    points: WEIGHTS.zombie,
    insight:
      "Deals created long ago but still in an early stage rarely convert.",
  },
  missing_amount: {
    label: "no amount",
    points: WEIGHTS.missingAmount,
    insight: "Without an amount the deal can't be valued or forecast.",
  },
  missing_close_date: {
    label: "no close date",
    points: WEIGHTS.missingCloseDate,
    insight: "Without a close date the deal can't be placed in a forecast period.",
  },
  missing_owner: {
    label: "no owner",
    points: WEIGHTS.missingOwner,
    insight: "With no owner, no one is accountable for moving it forward.",
  },
  missing_next_step: {
    label: "no next step",
    points: WEIGHTS.missingNextStep,
    insight: "A missing next step is the clearest sign a deal is drifting without a plan.",
  },
};

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

/** Traffic-light status from a category score (same thresholds as the gauge bands). */
export function statusFromShare(score: number | null, max: number): Status {
  if (score == null || max === 0 || score === 0) return "na";
  const share = score / max;
  if (share >= STATUS_THRESHOLDS.good) return "good";
  if (share >= STATUS_THRESHOLDS.warn) return "warn";
  return "bad";
}

// ---------------------------------------------------------------------------
// Finding-dot severity. A finding's colour reflects how many category points
// (out of 25) it removed from the score — i.e. its real impact — not how many
// deals tripped it. This keeps a green category from showing alarming red
// bullets for a common-but-trivial issue (e.g. "no next step", weight 1).
// Tunable.
// ---------------------------------------------------------------------------
export const FINDING_SEVERITY = {
  bad: 3.5, // removed >= 3.5 of 25 points -> red
  warn: 1, // removed >= 1 point -> amber, else muted
};

/** Traffic-light status for a single finding, from the points it cost the score. */
export function findingSeverityFromPoints(points: number): Status {
  if (points >= FINDING_SEVERITY.bad) return "bad";
  if (points >= FINDING_SEVERITY.warn) return "warn";
  return "na";
}

/** Map an overall 0..100 score to a short grade label for the headline. */
export function gradeFor(score: number): string {
  if (score >= 85) return "Healthy";
  if (score >= 70) return "Solid, with leaks";
  if (score >= 55) return "Shaky";
  if (score >= 40) return "At risk";
  return "Critical";
}
