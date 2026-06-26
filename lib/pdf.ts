// Client-side PDF report. No server. Uses jsPDF + autotable for shareable output.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { DiagnosticResult, Status } from "./types";

const INK = "#0d1117";
const MUTED = "#5b6472";
const GOOD = "#0f9d58";
const WARN = "#c47f17";
const BAD = "#d23f31";

function statusColor(s: Status): string {
  return s === "good" ? GOOD : s === "warn" ? WARN : s === "bad" ? BAD : MUTED;
}

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
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

export function generatePdf(result: DiagnosticResult): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(INK);
  doc.text("Pipeline Pressure Test", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })}  ·  ${result.meta.dealsAnalyzed} deals  ·  computed in-browser`,
    M,
    y + 16
  );
  y += 44;

  if (result.meta.insufficientData || result.score == null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(WARN);
    doc.text(result.grade, M, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    doc.text(
      "Not enough columns mapped for a numeric score. Map Amount and Stage, then re-run.",
      M,
      y + 28,
      { maxWidth: W - M * 2 }
    );
    y += 52;
  } else {
    const scoreColor =
      result.score >= 70 ? GOOD : result.score >= 50 ? WARN : BAD;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(56);
    doc.setTextColor(scoreColor);
    doc.text(String(result.score), M, y + 30);
    doc.setFontSize(12);
    doc.setTextColor(MUTED);
    doc.text("/ 100", M + 78, y + 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(INK);
    doc.text(result.grade, M + 78, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(MUTED);
    doc.text(
      `${money(result.meta.totalOpenValue)} open  ·  ${money(result.meta.weightedPipeline)} weighted`,
      M + 78,
      y + 50
    );
    y += 78;
  }

  doc.setDrawColor(220);
  doc.line(M, y, W - M, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text("Category breakdown", M, y);
  y += 16;

  const colW = (W - M * 2 - 16) / 2;
  const startY = y;
  result.categories.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (colW + 16);
    const cy = startY + row * 56;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.text(c.label, x, cy);
    doc.setTextColor(statusColor(c.status));
    const scoreLabel = c.score == null ? "N/A" : `${c.score}/25`;
    doc.text(scoreLabel, x + colW - doc.getTextWidth(scoreLabel), cy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED);
    doc.text(doc.splitTextToSize(c.headline, colW), x, cy + 13);
  });
  y = startY + Math.ceil(result.categories.length / 2) * 56 + 8;

  doc.setDrawColor(220);
  doc.line(M, y, W - M, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK);
  doc.text("Deals quietly killing your forecast", M, y);
  y += 18;

  if (result.worstDeals.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(MUTED);
    doc.text("No high-risk deals flagged.", M, y);
    y += 16;
  } else {
    result.worstDeals.forEach((d, i) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(INK);
      const title = `${i + 1}. ${d.name}`;
      doc.text(title, M, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(MUTED);
      doc.setFontSize(8.5);
      const line = `${money(d.amount)}${d.stage ? " · " + d.stage : ""}  ·  risk ${d.riskScore}`;
      doc.text(line, M, y + 12);
      const reason = d.primaryReason || d.reasons.join(" · ");
      doc.text(doc.splitTextToSize(reason, W - M * 2), M, y + 24);
      y += 24 + doc.splitTextToSize(reason, W - M * 2).length * 10 + 6;
    });
  }

  // Page 2 — methodology + top at-risk table
  doc.addPage();
  y = 56;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK);
  doc.text("Methodology & data used", M, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  const methodLines = [
    "Score = applicable categories (each /25) rescaled to 100. Missing categories are excluded.",
    `Weighting: ${weightingLabel(result)}`,
    `Mapped fields: ${result.meta.mappedFields.join(", ") || "none"}`,
    `Checks run: ${result.ranChecks.join(", ") || "none"}`,
    result.skippedChecks.length
      ? `Skipped: ${result.skippedChecks.map((s) => s.name).join(", ")}`
      : "",
    "Worst deals ranked by summed flag weights (late-stage + stale is heaviest).",
    "pipeline-pressure-test — runs entirely in your browser.",
  ].filter(Boolean);
  methodLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, W - M * 2);
    doc.text(wrapped, M, y);
    y += wrapped.length * 11 + 6;
  });

  y += 12;
  const topAtRisk = result.rankedDeals.filter((d) => d.riskScore > 0).slice(0, 10);
  if (topAtRisk.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK);
    doc.text("Top at-risk deals", M, y);
    y += 8;

    autoTable(doc, {
      startY: y + 4,
      margin: { left: M, right: M },
      head: [["Deal", "Amount", "Stage", "Risk", "Primary flag"]],
      body: topAtRisk.map((d) => [
        d.name,
        money(d.amount),
        d.stage ?? "—",
        String(d.riskScore),
        d.primaryReason,
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    });
  }

  doc.save("pipeline-pressure-test.pdf");
}
