"use client";

import type { RankedDeal } from "@/lib/types";
import { riskTier, RISK_TIER_META, type RiskTier } from "@/lib/deal-list-utils";
import { FLAG_META } from "@/lib/scoring-config";
import { cn } from "@/lib/cn";

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/**
 * Shared column template so the desktop row and every list header line up
 * exactly. Each list owns its own header, but reuses these widths. The chevron
 * slot is always reserved so expandable and non-expandable lists stay aligned.
 */
export const DEAL_COLS = {
  rank: "w-5 shrink-0",
  name: "flex-1 min-w-0",
  amount: "w-24 text-right shrink-0",
  stage: "w-[100px] shrink-0 hidden md:block",
  severity: "w-[96px] shrink-0",
  flag: "w-[180px] shrink-0 hidden lg:block",
  chevron: "w-4 shrink-0",
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
  expanded = false,
  onToggle,
}: {
  deal: RankedDeal;
  rank?: number;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const expandable = !!onToggle && deal.reasons.length > 0;

  return (
    <>
      <div
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        onClick={expandable ? onToggle : undefined}
        onKeyDown={
          expandable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle?.();
                }
              }
            : undefined
        }
        className={cn(
          "hidden sm:flex items-center gap-3 px-3 py-2.5 border-b border-border/60 last:border-0",
          expandable && "cursor-pointer hover:bg-surface/80"
        )}
      >
        {rank != null && (
          <span className={cn("tnum text-xs text-muted-2", DEAL_COLS.rank)}>
            {rank}
          </span>
        )}
        <span
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
        <span className={cn("text-xs text-muted truncate", DEAL_COLS.stage)}>
          {deal.stage ?? "—"}
        </span>
        <span className={DEAL_COLS.severity}>
          <SeverityBadge score={deal.riskScore} />
        </span>
        <span className={cn("text-xs text-muted truncate", DEAL_COLS.flag)}>
          {deal.primaryReason || "—"}
        </span>
        <span className={cn("text-muted-2 text-xs", DEAL_COLS.chevron)}>
          {expandable ? (expanded ? "▾" : "▸") : ""}
        </span>
      </div>

      <div
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        onClick={expandable ? onToggle : undefined}
        onKeyDown={
          expandable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle?.();
                }
              }
            : undefined
        }
        className={cn(
          "sm:hidden rounded-xl border border-border bg-surface/70 p-3",
          expandable && "cursor-pointer"
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
              <SeverityBadge score={deal.riskScore} />
            </div>
            <p className="mt-1 text-xs text-muted">
              {money(deal.amount)}
              {deal.stage ? ` · ${deal.stage}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-muted-2">
              {deal.primaryReason || "—"}
            </p>
          </div>
        </div>
      </div>

      {expanded && deal.reasons.length > 0 && (
        <DealDetail deal={deal} />
      )}
    </>
  );
}

function DealDetail({ deal }: { deal: RankedDeal }) {
  const breakdown = flagBreakdown(deal.flags);
  const topInsight = breakdown[0]?.insight;

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
    </div>
  );
}

export function SortBtn({
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
        "cursor-pointer hover:text-foreground",
        active ? "text-foreground" : "text-muted"
      )}
    >
      {label}
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
