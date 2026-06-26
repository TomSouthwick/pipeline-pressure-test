"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import type { WorstDeal } from "@/lib/types";

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function WorstDeals({ deals }: { deals: WorstDeal[] }) {
  const [parent] = useAutoAnimate();

  if (deals.length === 0) {
    return (
      <div className="rounded-xl border border-good/30 bg-surface/70 p-5 text-sm text-muted">
        No high-risk deals flagged. This pipeline is unusually clean.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-3">
        Deals quietly killing your forecast
      </h3>
      <ol ref={parent} className="flex flex-col gap-2">
        {deals.map((d, i) => (
          <motion.li
            key={d.rowIndex}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.4 + i * 0.07, ease: "easeOut" }}
            className="rounded-xl border border-border bg-surface/70 p-4 flex items-start gap-4"
          >
            <span className="tnum text-xs text-muted-2 w-4 pt-0.5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground truncate">
                  {d.name}
                </span>
                <span className="tnum text-xs text-muted shrink-0">
                  {money(d.amount)}
                  {d.stage ? (
                    <span className="text-muted-2"> · {d.stage}</span>
                  ) : null}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-muted leading-relaxed">
                {d.primaryReason || d.reasons.join(" · ")}
              </p>
            </div>
            <span
              title="risk score"
              className="tnum text-xs font-semibold text-bad shrink-0 rounded-md border border-bad/30 bg-bad/10 px-2 py-1"
            >
              {d.riskScore}
            </span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
