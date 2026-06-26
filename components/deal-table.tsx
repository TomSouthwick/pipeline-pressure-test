"use client";

import * as React from "react";
import type { RankedDeal } from "@/lib/types";
import { WEIGHTS } from "@/lib/scoring-config";
import { cn } from "@/lib/cn";

type Filter = "all" | "at-risk" | "critical" | "clean";
type SortKey = "risk" | "amount" | "closeDate" | "name";

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

const CRITICAL_THRESHOLD = WEIGHTS.lateStageStale;

export function DealTable({ deals }: { deals: RankedDeal[] }) {
  const [filter, setFilter] = React.useState<Filter>("at-risk");
  const [sortKey, setSortKey] = React.useState<SortKey>("risk");
  const [sortAsc, setSortAsc] = React.useState(false);
  const [open, setOpen] = React.useState(true);

  const filtered = React.useMemo(() => {
    let list = deals;
    if (filter === "at-risk") list = deals.filter((d) => d.riskScore > 0);
    else if (filter === "critical")
      list = deals.filter((d) => d.riskScore >= CRITICAL_THRESHOLD);
    else if (filter === "clean") list = deals.filter((d) => d.riskScore === 0);

    const dir = sortAsc ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "risk") return (a.riskScore - b.riskScore) * dir;
      if (sortKey === "amount") {
        const av = a.amount ?? -Infinity;
        const bv = b.amount ?? -Infinity;
        if (a.amount == null && b.amount == null) return 0;
        if (a.amount == null) return 1;
        if (b.amount == null) return -1;
        return (av - bv) * dir;
      }
      if (sortKey === "closeDate") {
        if (!a.closeDate && !b.closeDate) return 0;
        if (!a.closeDate) return 1;
        if (!b.closeDate) return -1;
        return a.closeDate.localeCompare(b.closeDate) * dir;
      }
      return a.name.localeCompare(b.name) * dir;
    });
  }, [deals, filter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "at-risk", label: "At risk" },
    { id: "critical", label: "Critical" },
    { id: "clean", label: "Clean" },
  ];

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left cursor-pointer group"
      >
        <h3 className="text-sm font-medium text-foreground">
          All deals ({deals.length})
        </h3>
        <span className="text-xs text-muted group-hover:text-foreground">
          {open ? "Hide" : "Show"} table
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2 mb-3">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs border cursor-pointer transition-colors",
                  filter === f.id
                    ? "bg-accent/15 border-accent/60 text-foreground"
                    : "border-border-strong text-muted hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted rounded-xl border border-border bg-surface/70 p-4">
              No deals match this filter.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface/80 text-left text-xs text-muted">
                      <th className="px-3 py-2 font-medium">
                        <SortBtn label="Deal" active={sortKey === "name"} onClick={() => toggleSort("name")} />
                      </th>
                      <th className="px-3 py-2 font-medium">
                        <SortBtn label="Amount" active={sortKey === "amount"} onClick={() => toggleSort("amount")} />
                      </th>
                      <th className="px-3 py-2 font-medium">Stage</th>
                      <th className="px-3 py-2 font-medium">
                        <SortBtn label="Risk" active={sortKey === "risk"} onClick={() => toggleSort("risk")} />
                      </th>
                      <th className="px-3 py-2 font-medium hidden md:table-cell">
                        <SortBtn label="Close" active={sortKey === "closeDate"} onClick={() => toggleSort("closeDate")} />
                      </th>
                      <th className="px-3 py-2 font-medium">Primary flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => (
                      <tr key={d.rowIndex} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2.5 font-medium text-foreground max-w-[180px] truncate">
                          {d.name}
                        </td>
                        <td className="px-3 py-2.5 tnum text-muted whitespace-nowrap">
                          {money(d.amount)}
                        </td>
                        <td className="px-3 py-2.5 text-muted text-xs max-w-[120px] truncate">
                          {d.stage ?? "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "tnum text-xs font-semibold rounded-md px-2 py-0.5",
                              d.riskScore >= CRITICAL_THRESHOLD
                                ? "text-bad bg-bad/10 border border-bad/30"
                                : d.riskScore > 0
                                  ? "text-warn bg-warn/10 border border-warn/30"
                                  : "text-muted-2"
                            )}
                          >
                            {d.riskScore}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 tnum text-xs text-muted-2 hidden md:table-cell whitespace-nowrap">
                          {d.closeDate ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted max-w-[220px] truncate">
                          {d.primaryReason || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden flex flex-col gap-2">
                {filtered.map((d) => (
                  <div
                    key={d.rowIndex}
                    className="rounded-xl border border-border bg-surface/70 p-3"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-medium truncate">{d.name}</span>
                      <span className="tnum text-xs font-semibold text-bad shrink-0">
                        {d.riskScore}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {money(d.amount)}
                      {d.stage ? ` · ${d.stage}` : ""}
                    </p>
                    {d.primaryReason && (
                      <p className="mt-1 text-[11px] text-muted-2">{d.primaryReason}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SortBtn({
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
