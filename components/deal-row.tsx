"use client";

import * as React from "react";
import type { RankedDeal } from "@/lib/types";
import { riskTier, RISK_TIER_META, type RiskTier } from "@/lib/deal-list-utils";
import { FLAG_META } from "@/lib/scoring-config";
import { useDealCard } from "./deal-card";
import { cn } from "@/lib/cn";

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

function pct(p: number | null): string {
  return p == null ? "—" : `${Math.round(p * 100)}%`;
}

/**
 * Shared column template so desktop rows and list headers line up exactly.
 * Every data column is always shown on the desktop table (sm+); the name column
 * flexes and truncates (with a hover tooltip) to make room. Below sm the row
 * collapses to the stacked mobile card, which lists the same fields inline.
 */
export const DEAL_COLS = {
  rank: "w-5 shrink-0",
  name: "flex-1 min-w-0",
  amount: "w-20 text-right shrink-0",
  closeDate: "w-[78px] shrink-0",
  stage: "w-[92px] shrink-0",
  probability: "w-[44px] text-right shrink-0",
  severity: "w-[92px] shrink-0",
  flag: "w-[150px] shrink-0",
} as const;

const TIER_BADGE: Record<RiskTier, string> = {
  critical: "text-bad bg-bad/10 border-bad/30",
  "at-risk": "text-warn bg-warn/10 border-warn/30",
  watch: "text-muted bg-surface border-border-strong",
  clean: "text-muted-2 border-border",
};

/**
 * Severity-first risk badge: the tier (Critical / At risk / Watch / Clean) is
 * the headline; the raw points stay secondary for those who want the number.
 */
export function SeverityBadge({ score }: { score: number }) {
  const tier = riskTier(score);
  const meta = RISK_TIER_META[tier];
  return (
    <span
      title={`Risk score ${score} (sum of flag weights)`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        TIER_BADGE[tier]
      )}
    >
      {meta.label}
      {score > 0 && <span className="tnum font-normal opacity-70">{score}</span>}
    </span>
  );
}

/** Per-flag point breakdown for a deal, highest-weight first. */
function flagBreakdown(flags: string[]) {
  return flags
    .map((code) => FLAG_META[code])
    .filter((m): m is (typeof FLAG_META)[string] => Boolean(m))
    .sort((a, b) => b.points - a.points);
}

export function DealRow({
  deal,
  rank,
  showSeverity = true,
  reason,
}: {
  deal: RankedDeal;
  rank?: number;
  showSeverity?: boolean;
  /** Override issue column text (e.g. category-scoped reason). */
  reason?: string;
}) {
  const openCard = useDealCard();
  const hasDetail = deal.reasons.length > 0 || deal.strengths.length > 0;
  const clickable = !!openCard && hasDetail;
  const issueText = reason ?? deal.primaryReason;

  const rowProps = clickable
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: () => openCard!(deal),
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openCard!(deal);
          }
        },
      }
    : {};

  return (
    <>
      <div
        {...rowProps}
        className={cn(
          "hidden sm:flex items-center gap-3 px-3 py-2.5 border-b border-border/60 last:border-0",
          clickable && "cursor-pointer hover:bg-surface/80"
        )}
      >
        {rank != null && (
          <span className={cn("tnum text-xs text-muted-2", DEAL_COLS.rank)}>
            {rank}
          </span>
        )}
        <span
          title={deal.name}
          className={cn(
            "text-sm font-medium text-foreground truncate",
            DEAL_COLS.name
          )}
        >
          {deal.name}
        </span>
        <span
          className={cn("tnum text-xs text-muted whitespace-nowrap", DEAL_COLS.amount)}
        >
          {money(deal.amount)}
        </span>
        <span className={cn("tnum text-xs text-muted whitespace-nowrap", DEAL_COLS.closeDate)}>
          {fmtDate(deal.closeDate)}
        </span>
        <span title={deal.stage ?? undefined} className={cn("text-xs text-muted truncate", DEAL_COLS.stage)}>
          {deal.stage ?? "—"}
        </span>
        <span className={cn("tnum text-xs text-muted whitespace-nowrap", DEAL_COLS.probability)}>
          {pct(deal.probability)}
        </span>
        {showSeverity && (
          <span className={DEAL_COLS.severity}>
            <SeverityBadge score={deal.riskScore} />
          </span>
        )}
        <span title={issueText || undefined} className={cn("text-xs text-muted truncate", DEAL_COLS.flag)}>
          {issueText || "—"}
        </span>
      </div>

      <div
        {...rowProps}
        className={cn(
          "sm:hidden rounded-xl border border-border bg-surface/70 p-3",
          clickable && "cursor-pointer"
        )}
      >
        <div className="flex items-start gap-3">
          {rank != null && (
            <span className="tnum text-xs text-muted-2 w-4 pt-0.5 shrink-0">
              {rank}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{deal.name}</span>
              {showSeverity && <SeverityBadge score={deal.riskScore} />}
            </div>
            <p className="mt-1 text-xs text-muted">
              {money(deal.amount)}
              {deal.stage ? ` · ${deal.stage}` : ""}
              {deal.closeDate ? ` · ${fmtDate(deal.closeDate)}` : ""}
              {deal.probability != null ? ` · ${pct(deal.probability)}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-muted-2">{issueText || "—"}</p>
          </div>
        </div>
      </div>
    </>
  );
}

export function DealDetail({ deal }: { deal: RankedDeal }) {
  const breakdown = flagBreakdown(deal.flags);
  const topInsight = breakdown[0]?.insight;
  const openCard = useDealCard();

  return (
    <div className="px-3 py-3 bg-surface/50 border-b border-border/60 text-xs text-muted sm:pl-12 space-y-2">
      {breakdown.length > 0 && (
        <p className="text-muted-2">
          <span className="font-medium text-muted">Severity {deal.riskScore}</span>
          {" = "}
          {breakdown.map((f, i) => (
            <span key={f.label}>
              {i > 0 && " · "}
              {f.label} <span className="tnum">{f.points}</span>
            </span>
          ))}
        </p>
      )}
      {topInsight && (
        <p className="leading-relaxed">
          <span className="font-medium text-foreground">Why it matters: </span>
          {topInsight}
        </p>
      )}
      <ul className="space-y-0.5">
        {deal.reasons.map((r, i) => (
          <li key={i}>· {r}</li>
        ))}
      </ul>
      {deal.strengths.length > 0 && (
        <p className="leading-relaxed pt-1">
          <span className="font-medium text-good">What&apos;s healthy: </span>
          {deal.strengths.join(" · ")}
        </p>
      )}
      {openCard && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCard(deal);
          }}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline cursor-pointer"
        >
          View full details →
        </button>
      )}
    </div>
  );
}

/** Up/down chevrons; the active sort direction is solid, the rest faint. */
function SortArrows({ active, ascending }: { active: boolean; ascending: boolean }) {
  return (
    <svg width="7" height="10" viewBox="0 0 7 10" aria-hidden className="shrink-0">
      <path d="M3.5 0 L6.5 3.5 L0.5 3.5 Z" fill="currentColor" opacity={active && ascending ? 1 : 0.3} />
      <path d="M3.5 10 L0.5 6.5 L6.5 6.5 Z" fill="currentColor" opacity={active && !ascending ? 1 : 0.3} />
    </svg>
  );
}

export function SortBtn({
  label,
  active,
  onClick,
  sortable = false,
  ascending = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  /** Show the asc/desc indicator (use on sortable column headers + toolbar). */
  sortable?: boolean;
  /** Current direction when this is the active sort. */
  ascending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-sort={active ? (ascending ? "ascending" : "descending") : undefined}
      className={cn(
        "inline-flex items-center gap-1 cursor-pointer hover:text-foreground",
        active ? "text-foreground" : "text-muted"
      )}
    >
      {label}
      {sortable && <SortArrows active={active} ascending={ascending} />}
    </button>
  );
}

export function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs border cursor-pointer transition-colors",
        active
          ? "bg-accent/15 border-accent/60 text-foreground"
          : "border-border-strong text-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
