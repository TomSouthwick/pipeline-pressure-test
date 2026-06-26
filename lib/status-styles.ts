import type { Status } from "./types";

/** Tailwind classes keyed to traffic-light status (matches --good / --warn / --bad). */
export const STATUS_STYLES: Record<
  Status,
  {
    dot: string;
    ring: string;
    text: string;
    ringSelected: string;
    tabActive: string;
  }
> = {
  good: {
    dot: "bg-good",
    ring: "border-good/30",
    text: "text-good",
    ringSelected: "ring-good",
    tabActive: "bg-good/15 border-good/60 text-foreground",
  },
  warn: {
    dot: "bg-warn",
    ring: "border-warn/30",
    text: "text-warn",
    ringSelected: "ring-warn",
    tabActive: "bg-warn/15 border-warn/60 text-foreground",
  },
  bad: {
    dot: "bg-bad",
    ring: "border-bad/30",
    text: "text-bad",
    ringSelected: "ring-bad",
    tabActive: "bg-bad/15 border-bad/60 text-foreground",
  },
  na: {
    dot: "bg-muted-2",
    ring: "border-border",
    text: "text-muted-2",
    ringSelected: "ring-muted-2",
    tabActive: "bg-surface border-border-strong text-muted",
  },
};
