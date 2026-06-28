"use client";

import * as React from "react";
import { motion } from "motion/react";
import type { CategoryResult } from "@/lib/types";
import { STATUS_STYLES } from "@/lib/status-styles";
import { cn } from "@/lib/cn";

export function CategoryCard({
  category,
  index,
  selected = false,
  onSelect,
  onFindingSelect,
}: {
  category: CategoryResult;
  index: number;
  selected?: boolean;
  onSelect?: () => void;
  /** Drill into the deals behind one finding's specific flag. */
  onFindingSelect?: (flagCode: string) => void;
}) {
  const s = STATUS_STYLES[category.status];
  const pct =
    category.score != null ? Math.round((category.score / category.max) * 100) : 0;
  const interactive = !!onSelect;

  // Reconcile the "green score but N deals flagged" surprise: when the category
  // is healthy yet still carries low-impact findings, say so explicitly.
  const showReconcile =
    category.status === "good" &&
    category.findings.some((f) => f.flagCode && (f.points ?? 0) > 0);

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", s.dot)} />
          <span className="text-sm font-medium text-foreground">
            {category.label}
          </span>
        </div>
        <span className={cn("tnum text-sm font-semibold", s.text)}>
          {category.score == null ? "NA" : `${category.score}`}
          <span className="text-muted-2 font-normal">/{category.max}</span>
        </span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
        {category.score != null && (
          <motion.div
            className={cn("h-full rounded-full", s.dot)}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, delay: 0.3 + index * 0.08, ease: "easeOut" }}
          />
        )}
      </div>

      <p className="text-xs text-muted leading-relaxed">{category.headline}</p>

      {showReconcile && (
        <p className="text-[11px] text-muted-2 leading-relaxed">
          Still green — too few points lost here to dent the category score.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {category.findings.slice(0, 3).map((f, i) => {
          const clickable = !!f.flagCode && !!onFindingSelect;
          const inner = (
            <>
              {f.label}
              {f.detail ? (
                <span className="text-muted-2"> · {f.detail}</span>
              ) : null}
            </>
          );
          return (
            <li key={i} className="flex items-start gap-2 text-[12px]">
              <span
                className={cn(
                  "mt-[5px] h-1.5 w-1.5 rounded-full shrink-0",
                  STATUS_STYLES[f.severity].dot
                )}
              />
              {clickable ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFindingSelect!(f.flagCode!);
                  }}
                  className="text-left text-muted underline decoration-dotted decoration-border-strong underline-offset-2 hover:text-foreground hover:decoration-foreground/40 cursor-pointer transition-colors"
                >
                  {inner}
                </button>
              ) : (
                <span className="text-muted">{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );

  const className = cn(
    "rounded-xl border bg-surface/70 p-4 flex flex-col gap-3 text-left w-full",
    s.ring,
    interactive && "cursor-pointer transition-shadow hover:shadow-sm",
    selected && cn("ring-2 ring-offset-2 ring-offset-background", s.ringSelected)
  );

  // Root is a div (not button) so the finding bullets can be real nested
  // buttons — valid HTML and distinct click targets (card = select category,
  // bullet = drill into that flag's deals).
  const interactiveProps = interactive
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: onSelect,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelect!();
          }
        },
        "aria-pressed": selected,
      }
    : {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 + index * 0.08, ease: "easeOut" }}
      className={className}
      {...interactiveProps}
    >
      {content}
    </motion.div>
  );
}
