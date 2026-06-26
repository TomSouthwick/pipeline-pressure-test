"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { DropZone } from "./drop-zone";

// ssr:false prevents the SVG gauge from being rendered server-side, avoiding
// float-precision hydration mismatches in the tick-mark coordinates.
const ScoreDial = dynamic(
  () => import("./score-dial").then((m) => ({ default: m.ScoreDial })),
  { ssr: false }
);

interface HeroProps {
  onFile: (file: File) => void;
  onSampleSalesforce: () => void;
  onSampleHubspot: () => void;
  error?: string | null;
}

// Plays once per animKey — parent controls replay by incrementing animKey.
function CursorDragHint({ animKey }: { animKey: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-xl">
      <motion.div
        key={animKey}
        className="absolute"
        style={{ bottom: 68, left: 28 }}
        initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
        animate={{
          x: [0, 168, 168, 168],
          y: [0, -44, -44, -52],
          opacity: [0, 1, 1, 0],
          scale: [1, 1, 0.86, 1],
        }}
        transition={{
          duration: 3.2,
          repeat: 0,
          times: [0, 0.40, 0.70, 1],
          ease: "easeInOut",
        }}
      >
        {/* OS-style arrow cursor */}
        <svg
          width="22"
          height="24"
          viewBox="0 0 22 24"
          fill="none"
          style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.22))" }}
        >
          <path
            d="M2 2L2 18.5L6.4 14L9.5 21.5L12 20.5L8.8 13H15L2 2Z"
            fill="#0b1220"
            stroke="white"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        {/* CSV file badge */}
        <div
          className="absolute -top-8 left-4 flex items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-mono font-semibold text-white whitespace-nowrap"
          style={{
            background: "var(--accent)",
            boxShadow: "0 2px 12px rgba(37,99,235,0.45)",
          }}
        >
          <svg width="9" height="10" viewBox="0 0 9 10" fill="none" aria-hidden>
            <rect x="0.5" y="0.5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="0.9" opacity="0.8" />
            <path d="M2 3.5h5M2 5.5h3" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.8" />
          </svg>
          pipeline.csv
        </div>
      </motion.div>
    </div>
  );
}

export function Hero({
  onFile,
  onSampleSalesforce,
  onSampleHubspot,
  error,
}: HeroProps) {
  // Choreography: cursor leads every cycle.
  //   0 s    → cursor plays (3.2 s animation)
  //   3.5 s  → gauge resets to 0 and sweeps (0→88 linear, 88→90 decel, 90→94 ticks ≈ 6.7 s)
  //  ~10.2 s → gauge settles at 94
  //  ~10.2 s → 10 s gap
  //  ~20.2 s → cursor replays, cycle repeats
  const [cycleKey, setCycleKey] = React.useState(0);
  const [idleAnimKey, setIdleAnimKey] = React.useState(0);
  const gaugeKeyRef = React.useRef(1);

  React.useEffect(() => {
    const CURSOR_MS  = 3_500;  // cursor animation (3.2 s) + small lead-in buffer
    const GAUGE_MS   = 6_700;  // gauge sweep duration
    const GAP_MS     = 10_000; // pause between cycles

    // Reset gauge immediately so it shows 0 while cursor plays
    setIdleAnimKey(0);

    // Trigger gauge after cursor finishes
    const gaugeTimer = setTimeout(() => {
      setIdleAnimKey(gaugeKeyRef.current++);
    }, CURSOR_MS);

    // Start next cycle
    const nextTimer = setTimeout(() => {
      setCycleKey((k) => k + 1);
    }, CURSOR_MS + GAUGE_MS + GAP_MS);

    return () => { clearTimeout(gaugeTimer); clearTimeout(nextTimer); };
  }, [cycleKey]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-xl mx-auto text-center"
    >
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground text-balance leading-[1.05]">
        Score your open pipeline in seconds
      </h1>
      <p className="mt-4 text-[15px] text-muted text-balance leading-relaxed max-w-md mx-auto">
        Drop a CSV of your open opportunities. Get a 0–100 health score, four
        category breakdowns, and the deals quietly killing your forecast.
      </p>

      {/* Gauge with ambient glow */}
      <div className="mt-10 flex justify-center relative">
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            width: 340,
            height: 340,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.03) 55%, transparent 75%)",
          }}
        />
        <div style={{ filter: "drop-shadow(0 6px 32px rgba(37,99,235,0.12))" }}>
          <ScoreDial score={93} grade="" idle size={260} animKey={idleAnimKey} />
        </div>
      </div>

      {/* Drop zone — cursor hint positioned within this wrapper */}
      <div className="mt-8 max-w-md mx-auto relative">
        <CursorDragHint animKey={cycleKey} />
        <DropZone
          onFile={onFile}
          onSampleSalesforce={onSampleSalesforce}
          onSampleHubspot={onSampleHubspot}
          error={error}
        />
      </div>
    </motion.div>
  );
}
