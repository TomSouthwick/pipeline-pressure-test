// Client-side PDF report. No server. Uses jsPDF + autotable for shareable output.
//
// Layout: page 1 is a stand-alone executive snapshot (score + interpretation,
// category bars WITH their specific findings) that ends on an explicit call to
// action bridging to page 2 — the full list of deals to review — plus a
// condensed methodology footer. Colour lives in the bars and the wordmark only;
// all other text is monochrome so the report reads clean and prints well.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CategoryResult, DiagnosticResult, Finding, Status } from "./types";
import { arcColorRgb } from "./score-color";

const INK = "#0b1220";
const MUTED = "#5b6573";
const MUTED_2 = "#97a0ad";
const TRACK = "#eef1f4";
const HAIRLINE = "#e5e8ec";
const ACCENT = "#2563eb";
const ACCENT_TINT = "#eef3ff";
const PANEL = "#f6f7f9";
const GOOD = "#16a34a";
const WARN = "#a16207";
const BAD = "#dc2626";

// Wordmark gradient — matches the app (red → orange → green → blue, L→R).
type RGB = [number, number, number];
const WORDMARK_STOPS: [number, RGB][] = [
  [0, [239, 68, 68]],
  [0.24, [249, 115, 22]],
  [0.54, [34, 197, 94]],
  [1, [59, 130, 246]],
];

function sampleStops(stops: [number, RGB][], f: number): RGB {
  if (f <= stops[0][0]) return stops[0][1];
  if (f >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [f0, c0] = stops[i];
    const [f1, c1] = stops[i + 1];
    if (f <= f1) {
      const t = (f - f0) / (f1 - f0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

/** Draw the wordmark with a per-letter gradient. Returns the x cursor end. */
function gradientWordmark(doc: jsPDF, text: string, x: number, y: number): void {
  const total = doc.getTextWidth(text);
  let cx = 0;
  for (const ch of text) {
    const w = doc.getTextWidth(ch);
    const [r, g, b] = sampleStops(WORDMARK_STOPS, total ? (cx + w / 2) / total : 0);
    doc.setTextColor(r, g, b);
    doc.text(ch, x + cx, y);
    cx += w;
  }
}

function statusColor(s: Status): string {
  return s === "good" ? GOOD : s === "warn" ? WARN : s === "bad" ? BAD : MUTED_2;
}

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function weightingLabel(result: DiagnosticResult): string {
  const { meta } = result;
  if (meta.weightingMethod === "crm-probability") {
    return `CRM probabilities (${meta.dealsWithProbability}/${meta.dealsAnalyzed} deals)`;
  }
  if (meta.weightingMethod === "stage-map") return "Stage-based estimates";
  return "Not computed";
}

/** A one-line read on the score: which categories are dragging it down. */
function interpretation(result: DiagnosticResult): string {
  const weak = result.categories
    .filter((c) => c.score != null && (c.status === "warn" || c.status === "bad"))
    .sort((a, b) => a.score! / a.max - b.score! / b.max);
  if (weak.length === 0) {
    return "A healthy book — no category is dragging the forecast.";
  }
  const names = weak.slice(0, 2).map((c) => c.label);
  const list = names.length === 2 ? `${names[0]} and ${names[1]}` : names[0];
  return `${list} ${weak.length > 1 ? "are" : "is"} the biggest drag on the score.`;
}

/** Highest-impact issues across all categories, worst first. */
function priorities(result: DiagnosticResult): Finding[] {
  return result.categories
    .flatMap((c) => c.findings)
    .filter((f) => (f.severity === "bad" || f.severity === "warn") && (f.points ?? 0) > 0)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 3);
}

/** Up to two findings to show under a category bar (issues first, else positives). */
function topFindings(c: CategoryResult): Finding[] {
  const negatives = c.findings.filter((f) => f.severity !== "good");
  const pool = negatives.length ? negatives : c.findings;
  return [...pool].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, 2);
}

function sectionLabel(doc: jsPDF, text: string, x: number, y: number): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(MUTED_2);
  doc.text(text.toUpperCase(), x, y, { charSpace: 0.6 });
}

function footer(doc: jsPDF, W: number, H: number, M: number, page: string): void {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED_2);
  doc.text("Pipeline Pressure Test  ·  computed in your browser", M, H - 28);
  doc.text(page, W - M - doc.getTextWidth(page), H - 28);
}

export function generatePdf(result: DiagnosticResult): void {
  buildPdfDoc(result).save("pipeline-pressure-test.pdf");
}

/** Build the report document (no save) — separated so it can be rendered headless in tests. */
export function buildPdfDoc(result: DiagnosticResult): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const contentW = W - M * 2;
  let y = 54;

  // --- Header band (gradient wordmark to match the app) --------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  gradientWordmark(doc, "Pipeline Pressure Test", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(
    `Pipeline Health Report  ·  ${new Date().toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}  ·  ${result.meta.dealsAnalyzed} deals`,
    M,
    y + 15
  );
  y += 30;
  doc.setDrawColor(HAIRLINE);
  doc.line(M, y, W - M, y);
  y += 26;

  if (result.meta.insufficientData || result.score == null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(INK);
    doc.text(result.grade, M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    doc.text(
      "Not enough columns mapped for a numeric score. Map Amount and Stage, then re-run.",
      M,
      y + 18,
      { maxWidth: contentW }
    );
    footer(doc, W, H, M, "Page 1");
    return doc;
  }

  // --- Score hero (monochrome text; colour only in the bar) ----------------
  const frac = result.score / 100;
  const [sr, sg, sb] = arcColorRgb(frac);

  sectionLabel(doc, "Pipeline health", M, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(50);
  doc.setTextColor(INK);
  doc.text(String(result.score), M, y + 38);
  const numW = doc.getTextWidth(String(result.score));
  doc.setFontSize(12);
  doc.setTextColor(MUTED_2);
  doc.text("/ 100", M + numW + 8, y + 38);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK);
  doc.text(result.grade, M + numW + 8, y + 16);

  // Open vs weighted value, right-aligned against the hero.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(INK);
  const openLine = `${money(result.meta.totalOpenValue)} open`;
  const wtLine = `${money(result.meta.weightedPipeline)} weighted`;
  doc.text(openLine, W - M - doc.getTextWidth(openLine), y + 14);
  doc.setTextColor(MUTED);
  doc.text(wtLine, W - M - doc.getTextWidth(wtLine), y + 30);
  y += 50;

  // Score bar — THE gauge: the one place colour signals health.
  const barH = 8;
  doc.setFillColor(TRACK);
  doc.roundedRect(M, y, contentW, barH, 4, 4, "F");
  doc.setFillColor(sr, sg, sb);
  doc.roundedRect(M, y, Math.max(barH, contentW * frac), barH, 4, 4, "F");
  y += barH + 20;

  // Interpretation line.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(INK);
  const interp = doc.splitTextToSize(interpretation(result), contentW);
  doc.text(interp, M, y);
  y += interp.length * 13 + 22;

  // --- Category breakdown (full-width rows, with findings) -----------------
  sectionLabel(doc, "Category breakdown", M, y);
  y += 16;

  result.categories.forEach((c) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(c.label, M, y);
    const scoreLabel = c.score == null ? "NA / 25" : `${c.score} / 25`;
    doc.setTextColor(c.score == null ? MUTED_2 : INK);
    doc.text(scoreLabel, W - M - doc.getTextWidth(scoreLabel), y);

    // Category bar (status colour — a bar, not text).
    const cFrac = c.score == null ? 0 : c.score / c.max;
    doc.setFillColor(TRACK);
    doc.roundedRect(M, y + 6, contentW, 4, 2, 2, "F");
    if (cFrac > 0) {
      doc.setFillColor(statusColor(c.status));
      doc.roundedRect(M, y + 6, Math.max(4, contentW * cFrac), 4, 2, 2, "F");
    }
    y += 19;

    doc.setFontSize(8.5);
    topFindings(c).forEach((f) => {
      doc.setFillColor(MUTED_2);
      doc.circle(M + 2, y - 2.5, 1.4, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(INK);
      const labelText = `${f.label}  `;
      doc.text(labelText, M + 9, y);
      const lw = doc.getTextWidth(labelText);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED);
      const detail = doc.splitTextToSize(f.detail, contentW - 9 - lw);
      doc.text(detail, M + 9 + lw, y);
      y += Math.max(1, detail.length) * 11 + 1;
    });
    y += 8;
  });

  y += 2;

  // --- What to fix first (panel) -------------------------------------------
  const pri = priorities(result);
  if (pri.length > 0) {
    const rowH = 26;
    const panelH = 30 + pri.length * rowH;
    doc.setFillColor(PANEL);
    doc.roundedRect(M, y, contentW, panelH, 6, 6, "F");
    let py = y + 20;
    sectionLabel(doc, "What to fix first", M + 14, py);
    py += 16;
    pri.forEach((f, i) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(INK);
      doc.text(`${i + 1}.  ${f.label}`, M + 14, py);
      const impact = `-${Math.round(f.points ?? 0)} pts`;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED_2);
      doc.text(impact, W - M - 14 - doc.getTextWidth(impact), py);
      if (f.detail) {
        doc.setFontSize(8.5);
        doc.setTextColor(MUTED);
        doc.text(doc.splitTextToSize(f.detail, contentW - 28), M + 14, py + 11);
      }
      py += rowH;
    });
    y += panelH + 16;
  }

  // --- Call to action: bridge to page 2 ------------------------------------
  const atRisk = result.rankedDeals.filter((d) => d.riskScore > 0);
  if (atRisk.length > 0) {
    const ctaH = 52;
    doc.setFillColor(ACCENT_TINT);
    doc.roundedRect(M, y, contentW, ctaH, 6, 6, "F");
    doc.setFillColor(ACCENT);
    doc.rect(M, y, 3, ctaH, "F"); // accent stripe
    sectionLabel(doc, "Your move", M + 16, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    const top = pri[0]?.label;
    const cta = top
      ? `Review the ${atRisk.length} at-risk deals on page 2 — start with: ${top}.`
      : `Review the ${atRisk.length} at-risk deals listed on page 2.`;
    doc.text(doc.splitTextToSize(cta, contentW - 30), M + 16, y + 34);
  }

  footer(doc, W, H, M, "Page 1 of 2");

  // --- Page 2: the deals to review + methodology ---------------------------
  doc.addPage();
  y = 54;
  sectionLabel(doc, "Your move", M, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK);
  doc.text("Deals to review", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED);
  y += 16;
  doc.text(
    atRisk.length > 0
      ? `${atRisk.length} deals carrying forecast risk, heaviest first. Work top-down.`
      : "No deals are currently carrying forecast risk.",
    M,
    y
  );
  y += 18;

  if (atRisk.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["#", "Deal", "Amount", "Stage", "Close", "Risk", "What to fix"]],
      body: atRisk.map((d, i) => [
        String(i + 1),
        d.name,
        money(d.amount),
        d.stage ?? "—",
        fmtDate(d.closeDate),
        String(d.riskScore),
        d.primaryReason,
      ]),
      styles: { fontSize: 8, cellPadding: 4, textColor: INK, lineColor: HAIRLINE },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 18 },
        2: { halign: "right" },
        5: { halign: "right", cellWidth: 30 },
      },
      alternateRowStyles: { fillColor: [246, 247, 249] },
      didDrawPage: () => footer(doc, W, H, M, "Pipeline Pressure Test"),
    });
    type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };
    y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y;
    y += 26;
  }

  // Methodology footer — keep it for credibility, not the headline.
  if (y > H - 150) {
    doc.addPage();
    y = 54;
  }
  sectionLabel(doc, "How this score works", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  const methodLines = [
    "Score = applicable categories (each /25) rescaled to 100. Missing categories are excluded.",
    `Weighting: ${weightingLabel(result)}.`,
    result.meta.quota != null && result.meta.periodLabel
      ? `Coverage: ${result.meta.quotaPeriod === "year" ? "annual" : "quarterly"} target ${money(result.meta.quota)} vs ${money(result.meta.periodOpenValue)} closing in ${result.meta.periodLabel}${result.meta.periodDealsExcluded > 0 ? ` (${result.meta.periodDealsExcluded} deals excluded)` : ""}.`
      : "",
    `Mapped fields: ${result.meta.mappedFields.join(", ") || "none"}.`,
    result.skippedChecks.length
      ? `Skipped checks: ${result.skippedChecks.map((s) => s.name).join(", ")}.`
      : "",
    "Runs entirely in your browser — no pipeline data is uploaded.",
  ].filter(Boolean);
  methodLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, contentW);
    doc.text(wrapped, M, y);
    y += wrapped.length * 10 + 4;
  });

  return doc;
}
