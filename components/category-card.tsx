"use client";

import { motion } from "motion/react";
import type { CategoryResult } from "@/lib/types";
import { STATUS_STYLES } from "@/lib/status-styles";
import { cn } from "@/lib/cn";

export function CategoryCard({
  category,
  index,
  selected = false,
  onSelect,
}: {
  category: CategoryResult;
  index: number;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const s = STATUS_STYLES[category.status];
  const pct =
    category.score != null ? Math.round((category.score / category.max) * 100) : 0;
  const interactive = !!onSelect;

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

      <ul className="mt-auto flex flex-col gap-1.5 pt-1">
        {category.findings.slice(0, 3).map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px]">
            <span
              className={cn(
                "mt-1 h-1 w-1 rounded-full shrink-0",
                STATUS_STYLES[f.severity].dot
              )}
            />
            <span className="text-muted">
              {f.label}
              {f.detail ? (
                <span className="text-muted-2"> · {f.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </>
  );

  const className = cn(
    "rounded-xl border bg-surface/70 p-4 flex flex-col gap-3 text-left w-full",
    s.ring,
    interactive && "cursor-pointer transition-shadow hover:shadow-sm",
    selected && cn("ring-2 ring-offset-2 ring-offset-background", s.ringSelected)
  );

  if (interactive) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 + index * 0.08, ease: "easeOut" }}
        className={className}
        onClick={onSelect}
        aria-pressed={selected}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 + index * 0.08, ease: "easeOut" }}
      className={className}
    >
      {content}
    </motion.div>
  );
}
