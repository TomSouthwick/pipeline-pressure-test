"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { RankedDeal } from "@/lib/types";
import { riskTier, RISK_TIER_META } from "@/lib/deal-list-utils";
import { FLAG_META } from "@/lib/scoring-config";
import { STATUS_STYLES } from "@/lib/status-styles";
import { SeverityBadge } from "./deal-row";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Context — any deal row in any list can open the full card without prop
// drilling. The provider owns the single modal instance.
// ---------------------------------------------------------------------------
type OpenDealCard = (deal: RankedDeal) => void;
const DealCardContext = React.createContext<OpenDealCard | null>(null);

/** Returns an opener, or null when rendered outside a provider. */
export function useDealCard(): OpenDealCard | null {
  return React.useContext(DealCardContext);
}

export function DealCardProvider({ children }: { children: React.ReactNode }) {
  const [deal, setDeal] = React.useState<RankedDeal | null>(null);
  const open = React.useCallback<OpenDealCard>((d) => setDeal(d), []);
  const close = React.useCallback(() => setDeal(null), []);
  return (
    <DealCardContext.Provider value={open}>
      {children}
      <DealCardModal deal={deal} onClose={close} />
    </DealCardContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
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
    year: "numeric",
  });
}

/** Per-flag point breakdown, highest-weight first. */
function flagBreakdown(flags: string[]) {
  return flags
    .map((code) => FLAG_META[code])
    .filter((m): m is (typeof FLAG_META)[string] => Boolean(m))
    .sort((a, b) => b.points - a.points);
}

// ---------------------------------------------------------------------------
// Field grid
// ---------------------------------------------------------------------------
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="eyebrow text-[10px] text-muted-2">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function DealCardBody({ deal }: { deal: RankedDeal }) {
  const tier = riskTier(deal.riskScore);
  const tierMeta = RISK_TIER_META[tier];
  const tierStyle = STATUS_STYLES[tierMeta.status];
  const breakdown = flagBreakdown(deal.flags);
  const topInsight = breakdown[0]?.insight;

  // Identity fields show even when blank (their absence is itself a signal,
  // surfaced in Risks); the rest only appear when present.
  const lastActivityValue =
    deal.lastActivity != null
      ? `${fmtDate(deal.lastActivity)}${
          deal.daysSinceActivity != null
            ? ` · ${deal.daysSinceActivity}d ago`
            : ""
        }`
      : null;

  const fields: { label: string; value: string; always?: boolean }[] = [
    { label: "Amount", value: money(deal.amount), always: true },
    { label: "Stage", value: deal.stage ?? "—", always: true },
    { label: "Owner", value: deal.owner ?? "—", always: true },
    { label: "Close date", value: fmtDate(deal.closeDate), always: true },
    ...(deal.createdDate
      ? [{ label: "Created", value: fmtDate(deal.createdDate) }]
      : []),
    ...(lastActivityValue
      ? [{ label: "Last activity", value: lastActivityValue }]
      : []),
    ...(deal.nextStep ? [{ label: "Next step", value: deal.nextStep }] : []),
    ...(deal.probability != null
      ? [{ label: "Probability", value: `${Math.round(deal.probability * 100)}%` }]
      : []),
    ...(deal.forecastCategory
      ? [{ label: "Forecast", value: deal.forecastCategory }]
      : []),
  ];

  return (
    <div className="space-y-5">
      {/* Details grid */}
      <div>
        <p className="eyebrow mb-2 text-xs text-muted-2">Details</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border bg-surface/50 p-4">
          {fields.map((f) => (
            <Field key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      </div>

      {/* Risks */}
      {deal.reasons.length > 0 && (
        <div>
          <p className="eyebrow mb-2 text-xs text-muted-2">Risks</p>
          <div
            className={cn(
              "rounded-xl border bg-surface/50 p-4 space-y-3",
              tierStyle.ring
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge score={deal.riskScore} />
              {breakdown.map((f) => (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted"
                >
                  {f.label}
                  <span className="tnum text-muted-2">{f.points}</span>
                </span>
              ))}
            </div>
            {topInsight && (
              <p className="text-xs leading-relaxed text-muted">
                <span className="font-medium text-foreground">
                  Why it matters:{" "}
                </span>
                {topInsight}
              </p>
            )}
            <ul className="space-y-1 text-xs text-muted">
              {deal.reasons.map((r, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", tierStyle.dot)} />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* What's healthy */}
      {deal.strengths.length > 0 && (
        <div>
          <p className="eyebrow mb-2 text-xs text-muted-2">What&apos;s healthy</p>
          <div className="flex flex-wrap gap-2 rounded-xl border border-good/30 bg-good/5 p-4">
            {deal.strengths.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full border border-good/30 bg-background px-2.5 py-1 text-xs text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-good" />
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {deal.reasons.length === 0 && deal.strengths.length === 0 && (
        <p className="text-sm text-muted">
          No flags or notable signals for this deal.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal shell (native <dialog>, mirrors MethodologyModal)
// ---------------------------------------------------------------------------
function DealCardModal({
  deal,
  onClose,
}: {
  deal: RankedDeal | null;
  onClose: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const open = deal != null;

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onDialogClose = () => onClose();
    dialog.addEventListener("close", onDialogClose);
    return () => dialog.removeEventListener("close", onDialogClose);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="deal-card-title"
      className={cn(
        "deal-card-modal fixed inset-0 z-50 m-auto w-[calc(100%-2rem)] max-w-lg",
        "rounded-xl border border-border bg-background p-0 shadow-xl",
        "backdrop:bg-foreground/25 backdrop:backdrop-blur-[2px]"
      )}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      {deal && (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2
                id="deal-card-title"
                className="truncate text-base font-semibold tracking-tight text-foreground"
              >
                {deal.name}
              </h2>
              <p className="mt-0.5 text-xs text-muted-2">
                {money(deal.amount)}
                {deal.stage ? ` · ${deal.stage}` : ""}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="max-h-[min(70vh,640px)] overflow-y-auto px-5 py-4">
            <DealCardBody deal={deal} />
          </div>
        </>
      )}
    </dialog>,
    document.body
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
