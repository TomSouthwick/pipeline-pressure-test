import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCsvText, normalizeHeader } from "./csv";
import { autoDetect } from "./column-detection";
import { inferCrm } from "./crm-detection";
import { runDiagnostic } from "./scoring-engine";
import { DEFAULT_LATE_STAGES } from "./scoring-config";
import { isValidQuotaInput, parseQuotaInput } from "./parse";

const sampleSf = fs.readFileSync(
  path.resolve(__dirname, "../public/sample-pipeline.csv"),
  "utf8"
);
const sampleHs = fs.readFileSync(
  path.resolve(__dirname, "../public/sample-pipeline-hubspot.csv"),
  "utf8"
);
const NOW = new Date(2026, 5, 25);

function analyze(
  csv: string,
  lateStages = ["Proposal/Price Quote", "Negotiation/Review", "Commit"],
  quota?: number
) {
  const { headers, rows } = parseCsvText(csv);
  const { mapping } = autoDetect(headers, rows);
  return {
    mapping,
    headers,
    rows,
    crm: inferCrm(headers),
    result: runDiagnostic(rows, mapping, { lateStages, quota }, NOW),
  };
}

describe("auto-detection", () => {
  it("maps Salesforce-style headers correctly", () => {
    const { mapping } = analyze(sampleSf);
    expect(mapping.dealName).toBe("Opportunity Name");
    expect(mapping.amount).toBe("Amount");
    expect(mapping.stage).toBe("Stage");
    expect(mapping.probability).toBe("Probability (%)");
    expect(mapping.forecastCategory).toBe("Forecast Category");
  });

  it("maps HubSpot-style headers correctly", () => {
    const { mapping } = analyze(sampleHs);
    expect(mapping.dealName).toBe("Deal Name");
    expect(mapping.stage).toBe("Deal Stage");
    expect(mapping.probability).toBe("Deal probability");
    expect(mapping.forecastCategory).toBe("Forecast category");
  });

  it("strips BOM from headers", () => {
    const bomCsv = "\uFEFFDeal Name,Amount,Stage\nAcme,1000,Open";
    const { headers } = parseCsvText(bomCsv);
    expect(headers[0]).toBe("Deal Name");
    expect(normalizeHeader("\uFEFFDeal Name")).toBe("Deal Name");
  });

  it("default late-stage list includes commit stages", () => {
    expect(DEFAULT_LATE_STAGES).toContain("negotiation/review");
    expect(DEFAULT_LATE_STAGES).toContain("commit");
  });
});

describe("CRM inference", () => {
  it("detects Salesforce from fixture", () => {
    const { crm } = analyze(sampleSf);
    expect(crm.crm).toBe("salesforce");
    expect(crm.confidence).toBeGreaterThan(0.5);
  });

  it("detects HubSpot from fixture", () => {
    const { crm } = analyze(sampleHs);
    expect(crm.crm).toBe("hubspot");
    expect(crm.confidence).toBeGreaterThan(0.5);
  });
});

describe("quota parsing", () => {
  it("accepts valid positive numbers", () => {
    expect(parseQuotaInput("1000000")).toBe(1000000);
    expect(isValidQuotaInput("1000000")).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(parseQuotaInput(".")).toBeNull();
    expect(isValidQuotaInput(".")).toBe(false);
    expect(parseQuotaInput("")).toBeNull();
    expect(isValidQuotaInput("")).toBe(true);
  });
});

describe("diagnostic engine", () => {
  it("produces a score in an unhealthy-but-not-zero range", () => {
    const { result } = analyze(sampleSf);
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThan(0);
    expect(result.score!).toBeLessThan(100);
    expect(result.score!).toBeLessThan(80);
  });

  it("uses CRM probability weighting when column present", () => {
    const { result } = analyze(sampleSf);
    expect(result.meta.weightingMethod).toBe("crm-probability");
    expect(result.meta.dealsWithProbability).toBeGreaterThan(0);
  });

  it("scores categories; coverage N/A without quota", () => {
    const { result } = analyze(sampleSf);
    const byKey = Object.fromEntries(result.categories.map((c) => [c.key, c]));
    expect(byKey.hygiene.score).not.toBeNull();
    expect(byKey.momentum.score).not.toBeNull();
    expect(byKey.concentration.score).not.toBeNull();
    expect(byKey.coverage.score).toBeNull();
  });

  it("enables coverage when quota supplied", () => {
    const { result } = analyze(sampleSf, undefined, 800_000);
    const cov = result.categories.find((c) => c.key === "coverage")!;
    expect(cov.score).not.toBeNull();
    expect(result.meta.weightedPipeline).toBeGreaterThan(0);
  });

  it("surfaces seeded whale deals with primary reasons", () => {
    const { result } = analyze(sampleSf);
    expect(result.worstDeals.length).toBeGreaterThanOrEqual(3);
    const northwind = result.worstDeals.find(
      (d) => d.name === "Northwind Platform Renewal"
    )!;
    expect(northwind.primaryReason).toMatch(/late-stage/i);
    expect(northwind.rowIndex).toBeGreaterThanOrEqual(0);
  });

  it("rankedDeals includes all rows with stable rowIndex", () => {
    const { result, rows } = analyze(sampleSf);
    expect(result.rankedDeals.length).toBe(rows.length);
    const indices = new Set(result.rankedDeals.map((d) => d.rowIndex));
    expect(indices.size).toBe(rows.length);
  });

  it("duplicate deal names get distinct rowIndex", () => {
    const csv = `Deal Name,Stage,Amount,Close Date,Created Date,Last Activity
Northwind,Commit,1000,6/1/2026,1/1/2026,5/1/2026
Northwind,Open,2000,7/1/2026,2/1/2026,6/1/2026`;
    const { result } = analyze(csv, ["Commit"]);
    const north = result.rankedDeals.filter((d) => d.name === "Northwind");
    expect(north.length).toBe(2);
    expect(north[0].rowIndex).not.toBe(north[1].rowIndex);
  });

  it("flags insufficient data when only deal name mapped", () => {
    const csv = "Deal Name\nOnly Deal";
    const { headers, rows } = parseCsvText(csv);
    const mapping = autoDetect(headers, rows).mapping;
    const result = runDiagnostic(rows, mapping, { lateStages: [] }, NOW);
    expect(result.meta.insufficientData).toBe(true);
    expect(result.score).toBeNull();
    expect(result.grade).toBe("Not enough data");
  });

  it("skips late-stage stale when no late stages selected", () => {
    const { result } = analyze(sampleSf, []);
    const skipped = result.skippedChecks.map((s) => s.name);
    expect(skipped).toContain("Late-stage + stale combo");
  });

  it("records stuck-in-stage as skipped", () => {
    const { result } = analyze(sampleSf);
    expect(result.skippedChecks.map((s) => s.name)).toContain("Stuck in stage");
  });

  it("annotated rows carry risk columns", () => {
    const { result, rows } = analyze(sampleSf);
    expect(result.annotatedRows.length).toBe(rows.length);
    const flagged = result.annotatedRows.find((r) => Number(r._RiskScore) > 0)!;
    expect(flagged._Flags.length).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed now", () => {
    const a = analyze(sampleSf).result.score;
    const b = analyze(sampleSf).result.score;
    expect(a).toBe(b);
  });

  it("treats forecast Category Commit as late", () => {
    const csv = `Deal Name,Stage,Amount,Close Date,Created Date,Last Activity,Forecast category
Late Deal,Discovery,50000,6/30/2026,1/1/2026,1/1/2026,Commit`;
    const { result } = analyze(csv, []);
    const deal = result.rankedDeals[0];
    expect(deal.flags).toContain("late_stage_stale");
  });
});
