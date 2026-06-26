"use client";

import { motion } from "motion/react";
import type { CategoryResult, Status } from "@/lib/types";
import { cn } from "@/lib/cn";

const STATUS_STYLES: Record<Status, { dot: string; ring: string; text: string }> = {
  good: { dot: "bg-good", ring: "border-good/30", text: "text-good" },
  warn: { dot: "bg-warn", ring: "border-warn/30", text: "text-warn" },
  bad: { dot: "bg-bad", ring: "border-bad/30", text: "text-bad" },
  na: { dot: "bg-muted-2", ring: "border-border", text: "text-muted-2" },
};

export function CategoryCard({
  category,
  index,
}: {
  category: CategoryResult;
  index: number;
}) {
  const s = STATUS_STYLES[category.status];
  const pct =
    category.score != null ? Math.round((category.score / category.max) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 + index * 0.08, ease: "easeOut" }}
      className={cn(
        "rounded-xl border bg-surface/70 p-4 flex flex-col gap-3",
        s.ring
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", s.dot)} />
          <span className="text-sm font-medium text-foreground">
            {category.label}
          </span>
        </div>
        <span className={cn("tnum text-sm font-semibold", s.text)}>
          {category.score == null ? "N/A" : `${category.score}`}
          <span className="text-muted-2 font-normal">/{category.max}</span>
        </span>
      </div>

      {/* progress track */}
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
    </motion.div>
  );
}
