"use client";

import type { RankedDeal } from "@/lib/types";
import { CRITICAL_THRESHOLD } from "@/lib/deal-list-utils";
import { cn } from "@/lib/cn";

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function RiskBadge({ score }: { score: number }) {
  return (
    <span
      title="Risk score"
      className={cn(
        "tnum text-xs font-semibold rounded-md px-2 py-0.5 shrink-0",
        score >= CRITICAL_THRESHOLD
          ? "text-bad bg-bad/10 border border-bad/30"
          : score > 0
            ? "text-warn bg-warn/10 border border-warn/30"
            : "text-muted-2"
      )}
    >
      {score}
    </span>
  );
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
          <span className="tnum text-xs text-muted-2 w-5 shrink-0">{rank}</span>
        )}
        <span className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">
          {deal.name}
        </span>
        <span className="tnum text-xs text-muted whitespace-nowrap w-24 text-right">
          {money(deal.amount)}
        </span>
        <span className="text-xs text-muted max-w-[100px] truncate hidden md:block">
          {deal.stage ?? "—"}
        </span>
        <RiskBadge score={deal.riskScore} />
        <span className="text-xs text-muted max-w-[180px] truncate hidden lg:block">
          {deal.primaryReason || "—"}
        </span>
        {expandable && (
          <span className="text-muted-2 text-xs w-4 shrink-0">
            {expanded ? "▾" : "▸"}
          </span>
        )}
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
              <RiskBadge score={deal.riskScore} />
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
        <div className="px-3 py-2 bg-surface/50 border-b border-border/60 text-xs text-muted sm:pl-12">
          <ul className="space-y-0.5">
            {deal.reasons.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        </div>
      )}
    </>
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
