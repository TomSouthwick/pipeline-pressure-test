// Shared types for the diagnostic pipeline.

/** The canonical fields the engine understands. CRM headers map onto these. */
export type CanonicalField =
  | "dealName"
  | "amount"
  | "stage"
  | "owner"
  | "closeDate"
  | "createdDate"
  | "lastActivity"
  | "nextStep"
  // The CRM's own forecast fields. When present we prefer these over our
  // generic stage->probability map for weighted pipeline (far more defensible).
  | "probability"
  | "forecastCategory";

/** A raw parsed CSV row: header -> cell string. */
export type RawRow = Record<string, string>;

/** Result of auto-detection for one canonical field. */
export interface FieldGuess {
  field: CanonicalField;
  /** The detected source header, or null if nothing matched. */
  header: string | null;
  /** 0..1 confidence. >= HIGH_CONFIDENCE is pre-confirmed. */
  confidence: number;
  /** How the guess was made — shown subtly in the confirm UI. */
  via: "synonym" | "content" | "none";
}

/** User-confirmed mapping: canonical field -> source header (or null = absent). */
export type Mapping = Record<CanonicalField, string | null>;

export type QuotaPeriod = "quarter" | "year";

export interface RunOptions {
  /** Stage values the user flagged as late/commit. */
  lateStages: string[];
  /** Optional quota; enables the Coverage & Realism category when > 0. */
  quota?: number | null;
  /** Whether quota is a quarterly or annual target. Defaults to quarter. */
  quotaPeriod?: QuotaPeriod;
}

export type Status = "good" | "warn" | "bad" | "na";

export interface Finding {
  label: string;
  detail: string;
  severity: Status;
}

export interface CategoryResult {
  key: "hygiene" | "momentum" | "concentration" | "coverage";
  label: string;
  /** 0..25, or null when the whole category was skipped. */
  score: number | null;
  max: number;
  status: Status;
  headline: string;
  findings: Finding[];
}

export interface RankedDeal {
  rowIndex: number;
  name: string;
  amount: number | null;
  stage: string | null;
  owner: string | null;
  closeDate: string | null;
  riskScore: number;
  primaryReason: string;
  reasons: string[];
  flags: string[];
}

export interface WorstDeal {
  rowIndex: number;
  name: string;
  amount: number | null;
  stage: string | null;
  riskScore: number;
  primaryReason: string;
  reasons: string[];
}

export interface SkippedCheck {
  name: string;
  reason: string;
}

/** A single annotated row for CSV export: original cells + appended columns. */
export interface AnnotatedRow extends RawRow {
  _RiskScore: string;
  _Flags: string;
  _Reasons: string;
}

export interface DiagnosticResult {
  /** 0..100, higher = healthier. Null when insufficientData. */
  score: number | null;
  /** Letter-ish grade label derived from score, for the headline. */
  grade: string;
  categories: CategoryResult[];
  /** All deals ranked by risk (highest first). */
  rankedDeals: RankedDeal[];
  worstDeals: WorstDeal[];
  ranChecks: string[];
  skippedChecks: SkippedCheck[];
  annotatedRows: AnnotatedRow[];
  meta: {
    dealsAnalyzed: number;
    totalOpenValue: number;
    quota: number | null;
    quotaPeriod: QuotaPeriod | null;
    periodLabel: string | null;
    periodOpenValue: number | null;
    periodDealsIncluded: number;
    periodDealsExcluded: number;
    periodValueExcluded: number;
    weightedPipeline: number | null;
    /** How weighted pipeline was computed. */
    weightingMethod: "crm-probability" | "stage-map" | "none";
    /** How many deals contributed their own CRM probability to the weighting. */
    dealsWithProbability: number;
    /** True when no category could produce a score. */
    insufficientData: boolean;
    /** Canonical fields with a mapped source column. */
    mappedFields: CanonicalField[];
  };
}
