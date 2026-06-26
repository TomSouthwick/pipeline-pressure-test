// ============================================================================
// scoring-engine.ts — pure, deterministic diagnostic engine.
//
// runDiagnostic(rows, mapping, options) -> DiagnosticResult
//
// No DOM, no randomness, no I/O. `now` is injectable so tests are stable.
// All thresholds/weights come from scoring-config.ts. Any check whose required
// column is absent is skipped and recorded in skippedChecks.
// ============================================================================

import type {
  AnnotatedRow,
  CanonicalField,
  CategoryResult,
  DiagnosticResult,
  Finding,
  Mapping,
  QuotaPeriod,
  RankedDeal,
  RawRow,
  RunOptions,
  SkippedCheck,
  WorstDeal,
} from "./types";
import {
  CATEGORY_MAX,
  CONCENTRATION,
  COVERAGE,
  DEFAULT_STAGE_PROBABILITY,
  MOMENTUM,
  STAGE_PROBABILITY,
  statusFromShare,
  WEIGHTS,
  WORST_DEALS_COUNT,
  gradeFor,
} from "./scoring-config";
import { daysBetween, parseAmount, parseDate, parseProbability } from "./parse";
import { getPeriodBounds, isCloseDateInPeriod } from "./quota-period";

interface DealFlag {
  code: string;
  weight: number;
  reason: string;
}

interface Deal {
  index: number;
  name: string;
  amount: number | null;
  stage: string | null;
  stageNorm: string | null;
  owner: string | null;
  nextStep: string | null;
  closeDate: Date | null;
  createdDate: Date | null;
  lastActivity: Date | null;
  /** The CRM's own win probability for this deal (0..1), when provided. */
  probability: number | null;
  forecastCategory: string | null;
  isLate: boolean;
  daysSinceActivity: number | null;
  ageDays: number | null;
  flags: DealFlag[];
  raw: RawRow;
}

function present(mapping: Mapping, field: keyof Mapping): boolean {
  return !!mapping[field];
}

function cell(row: RawRow, header: string | null): string | null {
  if (!header) return null;
  const v = row[header];
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function quarterEnd(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  const endMonth = q * 3 + 2;
  return new Date(d.getFullYear(), endMonth + 1, 0); // last day of quarter
}

function buildRankedDeal(d: Deal): RankedDeal {
  const sortedFlags = [...d.flags].sort((a, b) => b.weight - a.weight);
  const reasons = sortedFlags.map((f) => f.reason);
  const flags = sortedFlags.map((f) => f.code);
  const riskScore = sortedFlags.reduce((s, f) => s + f.weight, 0);
  const closeDate =
    d.closeDate != null
      ? d.closeDate.toISOString().slice(0, 10)
      : null;
  return {
    rowIndex: d.index,
    name: d.name,
    amount: d.amount,
    stage: d.stage,
    owner: d.owner,
    closeDate,
    riskScore,
    primaryReason: sortedFlags[0]?.reason ?? "",
    reasons,
    flags,
  };
}

export function runDiagnostic(
  rows: RawRow[],
  mapping: Mapping,
  options: RunOptions,
  now: Date = new Date()
): DiagnosticResult {
  const lateSet = new Set(options.lateStages.map((s) => s.toLowerCase().trim()));
  const quota = options.quota && options.quota > 0 ? options.quota : null;
  const quotaPeriod: QuotaPeriod = options.quotaPeriod ?? "quarter";

  const has = {
    amount: present(mapping, "amount"),
    closeDate: present(mapping, "closeDate"),
    owner: present(mapping, "owner"),
    nextStep: present(mapping, "nextStep"),
    stage: present(mapping, "stage"),
    lastActivity: present(mapping, "lastActivity"),
    createdDate: present(mapping, "createdDate"),
    dealName: present(mapping, "dealName"),
    probability: present(mapping, "probability"),
    forecastCategory: present(mapping, "forecastCategory"),
  };

  // -- Parse rows into typed deals + per-deal flags ------------------------
  const deals: Deal[] = rows.map((raw, index) => {
    const amount = has.amount ? parseAmount(cell(raw, mapping.amount)) : null;
    const stage = has.stage ? cell(raw, mapping.stage) : null;
    const stageNorm = stage ? stage.toLowerCase().trim() : null;
    const owner = has.owner ? cell(raw, mapping.owner) : null;
    const nextStep = has.nextStep ? cell(raw, mapping.nextStep) : null;
    const closeDate = has.closeDate ? parseDate(cell(raw, mapping.closeDate)) : null;
    const createdDate = has.createdDate
      ? parseDate(cell(raw, mapping.createdDate))
      : null;
    const lastActivity = has.lastActivity
      ? parseDate(cell(raw, mapping.lastActivity))
      : null;

    const probability = has.probability
      ? parseProbability(cell(raw, mapping.probability))
      : null;
    const forecastCategory = has.forecastCategory
      ? cell(raw, mapping.forecastCategory)
      : null;
    const forecastNorm = forecastCategory
      ? forecastCategory.toLowerCase().trim()
      : null;

    const name =
      (has.dealName ? cell(raw, mapping.dealName) : null) ?? `Deal #${index + 1}`;
    // Late/commit: a stage the user flagged, OR a "Commit" forecast category.
    const isLate =
      (stageNorm ? lateSet.has(stageNorm) : false) || forecastNorm === "commit";
    const daysSinceActivity = lastActivity ? daysBetween(now, lastActivity) : null;
    const ageDays = createdDate ? daysBetween(now, createdDate) : null;

    const flags: DealFlag[] = [];

    // --- Hygiene flags ---
    if (has.amount && (amount == null || amount === 0)) {
      flags.push({
        code: "missing_amount",
        weight: WEIGHTS.missingAmount,
        reason: "missing or zero amount",
      });
    }
    if (has.closeDate && closeDate == null) {
      flags.push({
        code: "missing_close_date",
        weight: WEIGHTS.missingCloseDate,
        reason: "no close date",
      });
    } else if (has.closeDate && closeDate && daysBetween(now, closeDate) > 0) {
      flags.push({
        code: "overdue",
        weight: WEIGHTS.overdue,
        reason: `close date ${daysBetween(now, closeDate)} days in the past, still open`,
      });
    }
    if (has.owner && owner == null) {
      flags.push({
        code: "missing_owner",
        weight: WEIGHTS.missingOwner,
        reason: "no owner assigned",
      });
    }
    if (has.nextStep && nextStep == null) {
      flags.push({
        code: "missing_next_step",
        weight: WEIGHTS.missingNextStep,
        reason: "no next step defined",
      });
    }

    // --- Momentum flags ---
    if (daysSinceActivity != null) {
      if (daysSinceActivity >= MOMENTUM.stale.tier3) {
        flags.push({
          code: "stale_60",
          weight: WEIGHTS.stale60,
          reason: `no activity in ${daysSinceActivity} days`,
        });
      } else if (daysSinceActivity >= MOMENTUM.stale.tier2) {
        flags.push({
          code: "stale_30",
          weight: WEIGHTS.stale30,
          reason: `no activity in ${daysSinceActivity} days`,
        });
      } else if (daysSinceActivity >= MOMENTUM.stale.tier1) {
        flags.push({
          code: "stale_14",
          weight: WEIGHTS.stale14,
          reason: `no activity in ${daysSinceActivity} days`,
        });
      }
    }
    if (
      ageDays != null &&
      ageDays > MOMENTUM.zombieAgeDays &&
      stageNorm &&
      !isLate
    ) {
      flags.push({
        code: "zombie",
        weight: WEIGHTS.zombie,
        reason: `created ${ageDays} days ago, still in early stage (${stage})`,
      });
    }

    // --- Concentration: late-stage + stale combo (highest single weight) ---
    if (
      isLate &&
      daysSinceActivity != null &&
      daysSinceActivity >= CONCENTRATION.lateStageStaleDays
    ) {
      flags.push({
        code: "late_stage_stale",
        weight: WEIGHTS.lateStageStale,
        reason: `late-stage commit (${stage}), no activity in ${daysSinceActivity} days`,
      });
    }

    return {
      index,
      name,
      amount,
      stage,
      stageNorm,
      owner,
      nextStep,
      closeDate,
      createdDate,
      lastActivity,
      probability,
      forecastCategory,
      isLate,
      daysSinceActivity,
      ageDays,
      flags,
      raw,
    };
  });

  const n = deals.length;
  const ran: string[] = [];
  const skipped: SkippedCheck[] = [];

  const skip = (name: string, reason: string) => skipped.push({ name, reason });

  // -- HYGIENE -------------------------------------------------------------
  const hygiene = scoreHygiene(deals, has, ran, skip);

  // -- MOMENTUM ------------------------------------------------------------
  const momentum = scoreMomentum(deals, has, ran, skip);

  // -- CONCENTRATION & RISK ------------------------------------------------
  const concentration = scoreConcentration(deals, has, lateSet.size > 0, now, ran, skip);

  // -- COVERAGE & REALISM --------------------------------------------------
  // Weighted pipeline prefers each deal's OWN CRM probability when present
  // (far more defensible than our generic stage map); falls back to the stage
  // map, then a flat default. Track how many deals used their own probability.
  const totalOpenValue = deals.reduce((s, d) => s + (d.amount ?? 0), 0);
  let dealsWithProbability = 0;
  const weightedPipeline = has.amount
    ? deals.reduce((s, d) => {
        let p: number;
        if (d.probability != null) {
          p = d.probability;
          dealsWithProbability++;
        } else if (d.stageNorm) {
          p = STAGE_PROBABILITY[d.stageNorm] ?? DEFAULT_STAGE_PROBABILITY;
        } else {
          p = DEFAULT_STAGE_PROBABILITY;
        }
        return s + (d.amount ?? 0) * p;
      }, 0)
    : null;
  const weightingMethod: "crm-probability" | "stage-map" | "none" = !has.amount
    ? "none"
    : dealsWithProbability > 0
      ? "crm-probability"
      : "stage-map";

  let periodLabel: string | null = null;
  let periodOpenValue: number | null = null;
  let periodWeightedPipeline: number | null = null;
  let periodDealsIncluded = 0;
  let periodDealsExcluded = 0;
  let periodValueExcluded = 0;

  if (quota && has.closeDate && has.amount) {
    periodLabel = getPeriodBounds(quotaPeriod, now).label;
    let includedOpen = 0;
    let includedWeighted = 0;

    for (const d of deals) {
      const amt = d.amount ?? 0;
      if (
        !d.closeDate ||
        !isCloseDateInPeriod(d.closeDate, quotaPeriod, now)
      ) {
        periodDealsExcluded++;
        if (amt > 0) periodValueExcluded += amt;
        continue;
      }

      periodDealsIncluded++;
      if (d.amount != null) {
        includedOpen += d.amount;
        let p: number;
        if (d.probability != null) {
          p = d.probability;
        } else if (d.stageNorm) {
          p = STAGE_PROBABILITY[d.stageNorm] ?? DEFAULT_STAGE_PROBABILITY;
        } else {
          p = DEFAULT_STAGE_PROBABILITY;
        }
        includedWeighted += d.amount * p;
      }
    }

    periodOpenValue = includedOpen;
    periodWeightedPipeline = includedWeighted;
  }

  const coverage = scoreCoverage(
    periodOpenValue,
    periodWeightedPipeline,
    quota,
    has.amount,
    has.closeDate,
    periodLabel,
    periodDealsExcluded,
    periodValueExcluded,
    ran,
    skip
  );

  const categories: CategoryResult[] = [hygiene, momentum, concentration, coverage];

  // -- Overall score: rescale applicable categories to 100 -----------------
  const applicable = categories.filter((c) => c.score != null);
  const sumScore = applicable.reduce((s, c) => s + (c.score ?? 0), 0);
  const sumMax = applicable.reduce((s, c) => s + c.max, 0);
  const insufficientData = sumMax === 0;
  const score = insufficientData ? null : Math.round((100 * sumScore) / sumMax);

  const rankedDeals: RankedDeal[] = deals
    .map(buildRankedDeal)
    .sort(
      (a, b) =>
        b.riskScore - a.riskScore ||
        (b.amount ?? 0) - (a.amount ?? 0) ||
        a.rowIndex - b.rowIndex
    );

  const worstDeals: WorstDeal[] = rankedDeals
    .filter((d) => d.riskScore > 0)
    .slice(0, WORST_DEALS_COUNT)
    .map((d) => ({
      rowIndex: d.rowIndex,
      name: d.name,
      amount: d.amount,
      stage: d.stage,
      riskScore: d.riskScore,
      primaryReason: d.primaryReason,
      reasons: d.reasons,
    }));

  // -- Annotated rows for CSV export --------------------------------------
  const annotatedRows: AnnotatedRow[] = deals.map((d) => ({
    ...d.raw,
    _RiskScore: String(d.flags.reduce((s, f) => s + f.weight, 0)),
    _Flags: d.flags.map((f) => f.code).join("; "),
    _Reasons: d.flags.map((f) => f.reason).join("; "),
  }));

  const mappedFields = (
    Object.entries(mapping) as [CanonicalField, string | null][]
  )
    .filter(([, header]) => header != null)
    .map(([field]) => field);

  return {
    score,
    grade: insufficientData ? "Not enough data" : gradeFor(score ?? 0),
    categories,
    rankedDeals,
    worstDeals,
    ranChecks: ran,
    skippedChecks: skipped,
    annotatedRows,
    meta: {
      dealsAnalyzed: n,
      totalOpenValue,
      quota,
      quotaPeriod: quota ? quotaPeriod : null,
      periodLabel: quota && has.closeDate ? periodLabel : null,
      periodOpenValue: quota && has.closeDate ? periodOpenValue : null,
      periodDealsIncluded: quota && has.closeDate ? periodDealsIncluded : 0,
      periodDealsExcluded: quota && has.closeDate ? periodDealsExcluded : 0,
      periodValueExcluded: quota && has.closeDate ? periodValueExcluded : 0,
      weightedPipeline,
      weightingMethod,
      dealsWithProbability,
      insufficientData,
      mappedFields,
    },
  };
}

// ---------------------------------------------------------------------------
// Category scorers
// ---------------------------------------------------------------------------

function scoreHygiene(
  deals: Deal[],
  has: Record<string, boolean>,
  ran: string[],
  skip: (n: string, r: string) => void
): CategoryResult {
  const perDealMax =
    (has.amount ? WEIGHTS.missingAmount : 0) +
    (has.closeDate ? WEIGHTS.overdue : 0) + // overdue >= missingCloseDate
    (has.owner ? WEIGHTS.missingOwner : 0) +
    (has.nextStep ? WEIGHTS.missingNextStep : 0);

  if (perDealMax === 0 || deals.length === 0) {
    skip("Hygiene", "no hygiene columns (amount, close date, owner, next step) mapped");
    return naCategory("hygiene", "Hygiene", "No hygiene columns mapped.");
  }

  const hygieneCodes = new Set([
    "missing_amount",
    "missing_close_date",
    "overdue",
    "missing_owner",
    "missing_next_step",
  ]);
  let incurred = 0;
  const counts: Record<string, number> = {};
  for (const d of deals) {
    for (const f of d.flags) {
      if (hygieneCodes.has(f.code)) {
        incurred += f.weight;
        counts[f.code] = (counts[f.code] ?? 0) + 1;
      }
    }
  }
  const max = perDealMax * deals.length;
  const score = round1(CATEGORY_MAX * (1 - incurred / max));
  const cleanShare =
    deals.filter((d) => !d.flags.some((f) => hygieneCodes.has(f.code))).length /
    deals.length;

  if (has.amount) ran.push("Missing/zero amount");
  if (has.closeDate) ran.push("Missing or overdue close date");
  if (has.owner) ran.push("Missing owner");
  if (has.nextStep) ran.push("Missing next step");
  else skip("Missing next step", "no next-step column mapped");

  const findings: Finding[] = [];
  const label: Record<string, string> = {
    missing_amount: "missing or zero amount",
    missing_close_date: "no close date",
    overdue: "overdue (past close date, still open)",
    missing_owner: "no owner",
    missing_next_step: "no next step",
  };
  for (const [code, c] of Object.entries(counts)) {
    findings.push({
      label: `${c} ${c === 1 ? "deal" : "deals"} ${label[code]}`,
      detail: "",
      severity: c / deals.length > 0.25 ? "bad" : "warn",
    });
  }
  if (findings.length === 0) {
    findings.push({ label: "All deals pass basic hygiene checks", detail: "", severity: "good" });
  }

  return {
    key: "hygiene",
    label: "Hygiene",
    score,
    max: CATEGORY_MAX,
    status: statusFromShare(score, CATEGORY_MAX),
    headline: `${Math.round(cleanShare * 100)}% of deals are clean`,
    findings,
  };
}

function scoreMomentum(
  deals: Deal[],
  has: Record<string, boolean>,
  ran: string[],
  skip: (n: string, r: string) => void
): CategoryResult {
  const canStale = has.lastActivity;
  const canZombie = has.createdDate && has.stage;

  if (!canStale && !canZombie) {
    skip(
      "Momentum",
      "needs a last-activity column, or created-date + stage columns"
    );
    return naCategory("momentum", "Momentum", "No activity or age columns mapped.");
  }

  const perDealMax = (canStale ? WEIGHTS.stale60 : 0) + (canZombie ? WEIGHTS.zombie : 0);
  const momentumCodes = new Set(["stale_14", "stale_30", "stale_60", "zombie"]);

  let incurred = 0;
  const counts: Record<string, number> = {};
  for (const d of deals) {
    for (const f of d.flags) {
      if (momentumCodes.has(f.code)) {
        incurred += f.weight;
        counts[f.code] = (counts[f.code] ?? 0) + 1;
      }
    }
  }
  const max = perDealMax * deals.length;
  const score = round1(CATEGORY_MAX * (1 - incurred / max));

  if (canStale) ran.push("Activity recency (14/30/60 days)");
  else skip("Activity recency", "no last-activity column mapped");
  if (canZombie) ran.push("Zombie deals (old + early stage)");
  else skip("Zombie deals", "needs created-date + stage columns");
  // Stuck-in-stage genuinely needs stage-history a single export rarely has.
  skip("Stuck in stage", "needs stage-change history (not in a single export)");

  const findings: Finding[] = [];
  const stale = (counts.stale_14 ?? 0) + (counts.stale_30 ?? 0) + (counts.stale_60 ?? 0);
  if (counts.stale_60)
    findings.push({
      label: `${counts.stale_60} deals with no activity in 60+ days`,
      detail: "",
      severity: "bad",
    });
  if (counts.stale_30)
    findings.push({
      label: `${counts.stale_30} deals stalled 30–60 days`,
      detail: "",
      severity: "warn",
    });
  if (counts.zombie)
    findings.push({
      label: `${counts.zombie} zombie deals (90+ days old, still early stage)`,
      detail: "",
      severity: "bad",
    });
  if (findings.length === 0)
    findings.push({ label: "Pipeline is actively worked", detail: "", severity: "good" });

  return {
    key: "momentum",
    label: "Momentum",
    score,
    max: CATEGORY_MAX,
    status: statusFromShare(score, CATEGORY_MAX),
    headline: stale
      ? `${stale} deals losing momentum`
      : "Deals are moving",
    findings,
  };
}

function scoreConcentration(
  deals: Deal[],
  has: Record<string, boolean>,
  hasLateStages: boolean,
  now: Date,
  ran: string[],
  skip: (n: string, r: string) => void
): CategoryResult {
  const subPenalties: number[] = [];
  const findings: Finding[] = [];

  const valued = deals.filter((d) => d.amount != null && d.amount > 0);
  const totalValue = valued.reduce((s, d) => s + (d.amount ?? 0), 0);

  // 1. Close-date bunching (needs amount + close date)
  if (has.amount && has.closeDate && totalValue > 0) {
    let bunchedValue = 0;
    for (const d of valued) {
      if (!d.closeDate) continue;
      const qEnd = quarterEnd(d.closeDate);
      const daysToQEnd = daysBetween(qEnd, d.closeDate);
      if (daysToQEnd >= 0 && daysToQEnd < CONCENTRATION.bunchingWindowDays) {
        bunchedValue += d.amount ?? 0;
      }
    }
    const share = bunchedValue / totalValue;
    const pen =
      share <= CONCENTRATION.bunchingShare
        ? 0
        : (share - CONCENTRATION.bunchingShare) / (1 - CONCENTRATION.bunchingShare);
    subPenalties.push(pen);
    ran.push("Close-date bunching at quarter-end");
    if (share > CONCENTRATION.bunchingShare) {
      findings.push({
        label: `${Math.round(share * 100)}% of pipeline value closes in the final 7 days of a quarter`,
        detail: fmtMoney(bunchedValue),
        severity: "bad",
      });
    }
  } else {
    skip("Close-date bunching", "needs amount + close date columns");
  }

  // 2. Top-3 deal concentration (needs amount)
  if (has.amount && valued.length >= 3 && totalValue > 0) {
    const top3 = valued
      .map((d) => d.amount ?? 0)
      .sort((a, b) => b - a)
      .slice(0, 3)
      .reduce((s, v) => s + v, 0);
    const share = top3 / totalValue;
    const pen =
      share <= CONCENTRATION.top3Share
        ? 0
        : (share - CONCENTRATION.top3Share) / (1 - CONCENTRATION.top3Share);
    subPenalties.push(pen);
    ran.push("Top-3 deal concentration");
    if (share > CONCENTRATION.top3Share) {
      findings.push({
        label: `Top 3 deals are ${Math.round(share * 100)}% of open value`,
        detail: fmtMoney(top3),
        severity: "warn",
      });
    }
  } else {
    skip("Top-3 concentration", "needs amount column and 3+ deals");
  }

  // 3. Late-stage + stale combo (needs stage + last activity + late stages)
  if (has.stage && has.lastActivity && hasLateStages) {
    const lateDeals = deals.filter((d) => d.isLate);
    const lateStale = lateDeals.filter(
      (d) =>
        d.daysSinceActivity != null &&
        d.daysSinceActivity >= CONCENTRATION.lateStageStaleDays
    );
    const denom = lateDeals.length;
    const pen = denom > 0 ? lateStale.length / denom : 0;
    subPenalties.push(pen);
    ran.push("Late-stage + stale combo");
    if (lateStale.length > 0) {
      findings.push({
        label: `${lateStale.length} late-stage ${lateStale.length === 1 ? "deal has" : "deals have"} gone quiet (30+ days)`,
        detail: "highest-risk signal",
        severity: "bad",
      });
    }
  } else {
    skip(
      "Late-stage + stale combo",
      hasLateStages
        ? "needs stage + last-activity columns"
        : "no late/commit stages selected"
    );
  }

  if (subPenalties.length === 0) {
    return naCategory(
      "concentration",
      "Concentration & risk",
      "No concentration columns mapped."
    );
  }

  const penalty = subPenalties.reduce((s, p) => s + p, 0) / subPenalties.length;
  const score = round1(CATEGORY_MAX * (1 - penalty));
  if (findings.length === 0)
    findings.push({
      label: "Pipeline is well distributed",
      detail: "",
      severity: "good",
    });

  return {
    key: "concentration",
    label: "Concentration & risk",
    score,
    max: CATEGORY_MAX,
    status: statusFromShare(score, CATEGORY_MAX),
    headline:
      penalty > 0.4 ? "Forecast leans on too few, too late" : "Risk is spread sensibly",
    findings,
  };
}

function scoreCoverage(
  periodOpenValue: number | null,
  periodWeightedPipeline: number | null,
  quota: number | null,
  hasAmount: boolean,
  hasCloseDate: boolean,
  periodLabel: string | null,
  excludedDeals: number,
  excludedValue: number,
  ran: string[],
  skip: (n: string, r: string) => void
): CategoryResult {
  if (!quota) {
    skip("Coverage & realism", "no quota entered (optional)");
    return naCategory(
      "coverage",
      "Coverage & realism",
      "Enter a quota to score coverage."
    );
  }
  if (!hasAmount) {
    skip("Coverage & realism", "needs an amount column");
    return naCategory("coverage", "Coverage & realism", "No amount column mapped.");
  }
  if (!hasCloseDate) {
    skip("Coverage & realism", "needs close date for period coverage");
    return naCategory(
      "coverage",
      "Coverage & realism",
      "Map close date to score period coverage."
    );
  }

  const openValue = periodOpenValue ?? 0;
  const weighted = periodWeightedPipeline ?? 0;
  const label = periodLabel ?? "period";
  const coverageRatio = openValue / quota;
  const weightedRatio = weighted / quota;

  const covPen =
    coverageRatio >= COVERAGE.minCoverageRatio
      ? 0
      : (COVERAGE.minCoverageRatio - coverageRatio) / COVERAGE.minCoverageRatio;
  const wPen =
    weightedRatio >= COVERAGE.minWeightedRatio
      ? 0
      : (COVERAGE.minWeightedRatio - weightedRatio) / COVERAGE.minWeightedRatio;

  const penalty = (covPen + wPen) / 2;
  const score = round1(CATEGORY_MAX * (1 - penalty));

  ran.push("Coverage ratio vs quota");
  ran.push("Weighted pipeline vs quota");

  const findings: Finding[] = [
    {
      label: `${coverageRatio.toFixed(1)}x coverage in ${label}`,
      detail: `${fmtMoney(openValue)} open vs ${fmtMoney(quota)} target`,
      severity: coverageRatio < COVERAGE.minCoverageRatio ? "bad" : "good",
    },
    {
      label: `Weighted pipeline covers ${weightedRatio.toFixed(1)}x of your number`,
      detail: fmtMoney(weighted),
      severity: weightedRatio < COVERAGE.minWeightedRatio ? "bad" : "good",
    },
  ];

  if (excludedDeals > 0) {
    findings.push({
      label: `${excludedDeals} deals excluded (${fmtMoney(excludedValue)})`,
      detail: `No close date or outside ${label}`,
      severity: "warn",
    });
  }

  return {
    key: "coverage",
    label: "Coverage & realism",
    score,
    max: CATEGORY_MAX,
    status: statusFromShare(score, CATEGORY_MAX),
    headline:
      weightedRatio < COVERAGE.minWeightedRatio
        ? `Weighted pipeline covers only ${weightedRatio.toFixed(1)}x`
        : `${coverageRatio.toFixed(1)}x coverage in ${label}`,
    findings,
  };
}

function naCategory(
  key: CategoryResult["key"],
  label: string,
  headline: string
): CategoryResult {
  return {
    key,
    label,
    score: null,
    max: CATEGORY_MAX,
    status: "na",
    headline,
    findings: [{ label: headline, detail: "", severity: "na" }],
  };
}

function round1(n: number): number {
  return Math.round(Math.max(0, n) * 10) / 10;
}
