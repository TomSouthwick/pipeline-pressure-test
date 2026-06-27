"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { RankedDeal } from "@/lib/types";
import {
  filterDeals,
  sortDeals,
  type DealFilter,
  type DealSortKey,
} from "@/lib/deal-list-utils";
import { FilterPill, SortBtn, SeverityBadge } from "./deal-row";
import { cn } from "@/lib/cn";

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function DealDrawer({
  open,
  onClose,
  deals,
}: {
  open: boolean;
  onClose: () => void;
  deals: RankedDeal[];
}) {
  const [filter, setFilter] = React.useState<DealFilter>("at-risk");
  const [sortKey, setSortKey] = React.useState<DealSortKey>("risk");
  const [sortAsc, setSortAsc] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const list = filterDeals(deals, filter);
    return sortDeals(list, sortKey, sortAsc);
  }, [deals, filter, sortKey, sortAsc]);

  const toggleSort = (key: DealSortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const filters: { id: DealFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "at-risk", label: "At risk" },
    { id: "critical", label: "Critical" },
    { id: "clean", label: "Clean" },
  ];

  const content = (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close deal browser"
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px] cursor-pointer"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-drawer-title"
        tabIndex={-1}
        className={cn(
          "relative flex flex-col bg-background border-border shadow-xl outline-none",
          "w-full sm:w-[min(640px,92vw)] sm:border-l",
          "h-full max-h-[100dvh]"
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2 id="deal-drawer-title" className="text-sm font-medium text-foreground">
              All deals ({deals.length})
            </h2>
            <p className="text-xs text-muted-2 mt-0.5">
              Filter, sort, and scan every open deal
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-3 sm:px-5 border-b border-border">
          {filters.map((f) => (
            <FilterPill
              key={f.id}
              label={f.label}
              active={filter === f.id}
              onClick={() => setFilter(f.id)}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted rounded-xl border border-border bg-surface/70 p-4">
              No deals match this filter.
            </p>
          ) : (
            <>
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
                        <SortBtn label="Severity" active={sortKey === "risk"} onClick={() => toggleSort("risk")} />
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
                          <SeverityBadge score={d.riskScore} />
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

              <div className="sm:hidden flex flex-col gap-2">
                {filtered.map((d) => (
                  <div
                    key={d.rowIndex}
                    className="rounded-xl border border-border bg-surface/70 p-3"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-medium truncate">{d.name}</span>
                      <SeverityBadge score={d.riskScore} />
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
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
