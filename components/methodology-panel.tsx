"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { DiagnosticResult, Mapping } from "@/lib/types";

const CATEGORY_BLURBS: Record<
  "hygiene" | "momentum" | "concentration" | "coverage",
  string
> = {
  hygiene: "missing fields on deals",
  momentum: "stale or neglected deals",
  concentration: "bunching and forecast risk",
  coverage: "pipeline vs your target",
};

function categoryLine(category: DiagnosticResult["categories"][number]) {
  if (category.score == null && category.key === "coverage") {
    return "Not scored — no target entered";
  }
  if (category.score == null) {
    return "Not scored — not enough data in your export";
  }
  return CATEGORY_BLURBS[category.key];
}

function MethodologyContent({ result }: { result: DiagnosticResult }) {
  const { meta } = result;

  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted">
      {meta.insufficientData ? (
        <p className="text-foreground">
          Not enough columns were mapped to produce a score. Map at least Amount
          or Stage plus supporting fields, then run again.
        </p>
      ) : (
        <p>
          Your{" "}
          <strong className="font-medium text-foreground">0–100 score</strong>{" "}
          combines up to four categories (25 points each), rescaled to 100.
          Categories without enough data are skipped — if you didn&apos;t enter
          a target, Coverage is omitted and the rest rescale.
        </p>
      )}

      {!meta.insufficientData && (
        <div>
          <p className="eyebrow mb-2 text-xs text-muted-2">Categories</p>
          <ul className="space-y-1.5 text-xs">
            {result.categories.map((c) => (
              <li key={c.key}>
                <strong className="text-foreground">{c.label}</strong> —{" "}
                {categoryLine(c)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-2">
            A finding&apos;s dot colour reflects how much it drags the score, not
            how many deals it touches — so a common but minor issue stays muted.
          </p>
        </div>
      )}

      {meta.quota != null && meta.periodLabel && (
        <p className="text-xs">
          Coverage compares your{" "}
          {meta.quotaPeriod === "year" ? "annual" : "quarterly"} target to
          pipeline closing in {meta.periodLabel}.
        </p>
      )}

      {!meta.insufficientData && (
        <div>
          <p className="eyebrow mb-2 text-xs text-muted-2">Per-deal risk</p>
          <p className="text-xs">
            Each deal earns risk points by summing the weights of the issues it
            trips (a late-stage deal gone quiet is the heaviest). Those points
            roll up into a severity tier:{" "}
            <strong className="font-medium text-bad">Critical</strong>,{" "}
            <strong className="font-medium text-warn">At risk</strong>, or{" "}
            <strong className="font-medium text-foreground">Watch</strong>.
            Expand any deal to see the breakdown and why each flag matters.
          </p>
        </div>
      )}

      {result.skippedChecks.length > 0 && (
        <p className="text-xs">
          {result.skippedChecks.length}{" "}
          {result.skippedChecks.length === 1 ? "check couldn't" : "checks couldn't"}{" "}
          run with your export. See{" "}
          <strong className="font-medium text-foreground">checks ran</strong> at
          the bottom of this page for details.
        </p>
      )}
    </div>
  );
}

function MethodologyModal({
  open,
  onClose,
  result,
}: {
  open: boolean;
  onClose: () => void;
  result: DiagnosticResult;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

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
      aria-labelledby="methodology-title"
      className={cn(
        "methodology-modal fixed inset-0 z-50 m-auto w-[calc(100%-2rem)] max-w-md",
        "rounded-xl border border-border bg-background p-0 shadow-xl",
        "backdrop:bg-foreground/25 backdrop:backdrop-blur-[2px]"
      )}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <h2
          id="methodology-title"
          className="text-base font-semibold tracking-tight text-foreground"
        >
          How this score works
        </h2>
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
      <div className="px-5 py-4">
        <MethodologyContent result={result} />
      </div>
    </dialog>,
    document.body
  );
}

export function MethodologyPanel({
  result,
  mapping: _mapping,
  variant = "default",
  leading,
}: {
  result: DiagnosticResult;
  mapping: Mapping;
  variant?: "default" | "header";
  leading?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const isHeader = variant === "header";

  const openModal = () => setOpen(true);
  const closeModal = React.useCallback(() => setOpen(false), []);

  return (
    <>
      <div className={isHeader ? "mb-6" : "mt-8 border-t border-border pt-6"}>
        <div
          className={
            isHeader ? "flex items-center justify-between gap-4" : undefined
          }
        >
          {leading}
          {isHeader ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={openModal}
              className="shrink-0"
            >
              How this score works
            </Button>
          ) : (
            <button
              type="button"
              onClick={openModal}
              className="flex w-full cursor-pointer items-center justify-between text-sm font-medium text-foreground transition-colors hover:text-accent"
            >
              <span>How this score works</span>
            </button>
          )}
        </div>
      </div>

      <MethodologyModal open={open} onClose={closeModal} result={result} />
    </>
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
