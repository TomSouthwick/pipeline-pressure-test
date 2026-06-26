"use client";

import * as React from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "motion/react";

gsap.registerPlugin(useGSAP);

interface ScoreDialProps {
  score: number; // 0..100
  grade: string;
  idle?: boolean;
  size?: number;
  caption?: string;
  animKey?: number; // parent-controlled: increment to trigger idle animation
}

const SWEEP = 260;
const START = 90 + (360 - SWEEP) / 2;
const GRADIENT_SEGS = 24;

const r2 = (n: number) => Math.round(n * 100) / 100;

function polar(cx: number, cy: number, r: number, fraction: number) {
  const angle = ((START + fraction * SWEEP) * Math.PI) / 180;
  return { x: r2(cx + r * Math.cos(angle)), y: r2(cy + r * Math.sin(angle)) };
}

function describeArc(cx: number, cy: number, r: number, sf: number, ef: number): string {
  if (ef <= sf) return "";
  const s = polar(cx, cy, r, sf);
  const e = polar(cx, cy, r, ef);
  const large = (ef - sf) * SWEEP > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}


function lerp(t: number, pts: [number, number][]): number {
  if (t <= pts[0][0]) return pts[0][1];
  if (t >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, v0] = pts[i];
    const [t1, v1] = pts[i + 1];
    if (t <= t1) return v0 + ((t - t0) / (t1 - t0)) * (v1 - v0);
  }
  return pts[pts.length - 1][1];
}

// Physics-based HSL arc: red → orange → amber → yellow-green → green.
function arcColor(f: number): string {
  const h = lerp(f, [
    [0,    4],
    [0.28, 18],
    [0.46, 32],
    [0.60, 50],
    [0.75, 88],
    [1.0,  145],
  ]);
  const s = lerp(f, [[0, 84], [0.46, 92], [0.75, 80], [1, 68]]);
  const l = lerp(f, [[0, 52], [0.46, 54], [0.75, 47], [1, 40]]);
  return `hsl(${h.toFixed(1)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

/** Scores at/above this get a confetti + emoji burst on reveal. */
const CELEBRATION_THRESHOLD = 85;

const CONFETTI_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
];

const CELEBRATION_EMOJIS = ["✨", "🎯", "📈", "🚀", "💪", "🔥"];

function spawnCelebration(
  layer: HTMLElement,
  originX: number,
  originY: number,
  score: number
) {
  if (score < CELEBRATION_THRESHOLD) return;

  layer.querySelectorAll("[data-celebration]").forEach((el) => el.remove());

  const count = 22;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.dataset.celebration = "1";
    el.style.position = "absolute";
    el.style.left = `${originX}px`;
    el.style.top = `${originY}px`;
    el.style.pointerEvents = "none";
    el.style.willChange = "transform, opacity";
    el.style.transformOrigin = "center center";

    const isEmoji = i % 4 === 0;
    if (isEmoji) {
      el.textContent = CELEBRATION_EMOJIS[i % CELEBRATION_EMOJIS.length];
      el.style.fontSize = `${16 + (i % 3) * 4}px`;
      el.style.lineHeight = "1";
    } else {
      const w = 5 + (i % 4);
      const h = 7 + (i % 5);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      el.style.borderRadius = i % 2 === 0 ? "1px" : "999px";
    }

    layer.appendChild(el);

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.65;
    const dist = 60 + Math.random() * 95;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 28;

    gsap.fromTo(
      el,
      {
        x: 0,
        y: 0,
        scale: 0,
        opacity: 1,
        rotation: Math.random() * 180,
      },
      {
        x: dx,
        y: dy,
        scale: isEmoji ? 1.1 + Math.random() * 0.35 : 0.9 + Math.random() * 0.5,
        rotation: `+=${140 + Math.random() * 220}`,
        opacity: 0,
        duration: 1.45 + Math.random() * 0.75,
        ease: "power2.out",
        onComplete: () => el.remove(),
      }
    );
  }
}

export function ScoreDial({
  score,
  grade,
  idle = false,
  size = 240,
  caption,
  animKey = 0,
}: ScoreDialProps) {
  const reduce = useReducedMotion();
  const target = idle ? 93 : score;

  const mounted = React.useSyncExternalStore(
    (_cb) => () => {},
    () => true,
    () => false,
  );

  const cx = size / 2;
  const cy = size / 2;
  const arcW = Math.max(12, Math.round(size * 0.058));
  const R = cx - arcW / 2 - 6;
  const readoutY = cy + R * 0.055;

  const dialRef = React.useRef<HTMLDivElement>(null);
  const readoutRef = React.useRef<HTMLDivElement>(null);
  const burstRef = React.useRef<HTMLDivElement>(null);
  const proxy = React.useRef({ value: 0 });
  const [frac, setFrac] = React.useState(reduce ? target / 100 : 0);

  // revertOnUpdate kills the previous timeline and re-runs setup on dep change.
  useGSAP(
    () => {
      if (!mounted) return;
      // Idle gauges wait for the parent to trigger (animKey > 0); reset display when idle resets.
      if (idle && animKey === 0) {
        proxy.current.value = 0;
        setFrac(0);
        if (readoutRef.current) gsap.set(readoutRef.current, { scale: 1 });
        burstRef.current
          ?.querySelectorAll("[data-celebration]")
          .forEach((el) => el.remove());
        return;
      }

      const end = target / 100;

      if (reduce) {
        proxy.current.value = end;
        setFrac(end);
        return;
      }

      proxy.current.value = 0;
      setFrac(0);
      if (readoutRef.current) gsap.set(readoutRef.current, { scale: 1 });

      const tl = gsap.timeline({ delay: 0.016 });

      if (idle) {
        // Hero demo choreography: a long smooth sweep that leaves the final few
        // points, then a deliberate integer creep up to the real target so the
        // climb feels earned. (Tuned across the session for the landing gauge.)
        const sweepTo = Math.max(0, end - 0.03);
        tl.to(proxy.current, {
          value: sweepTo,
          duration: 4.7,
          ease: "power1.out",
          onUpdate: () => setFrac(proxy.current.value),
        });
        const from = Math.round(sweepTo * 100) + 1;
        const to = Math.round(end * 100);
        for (let v = from; v <= to; v++) {
          tl.to(proxy.current, {
            value: v / 100,
            duration: 0.34,
            ease: "sine.inOut",
            onUpdate: () => setFrac(proxy.current.value),
          }).to(proxy.current, {
            value: v / 100,
            duration: 0.22,
            ease: "none",
            onUpdate: () => setFrac(proxy.current.value),
          });
        }
      } else {
        // Real result: a smooth count-up to the ACTUAL score (not a fixed value).
        tl.to(proxy.current, {
          value: end,
          duration: 1.8,
          ease: "power2.out",
          onUpdate: () => setFrac(proxy.current.value),
        });
      }

      // Bigger pop when the count-up lands; confetti if the score is healthy (85+).
      if (readoutRef.current) {
        tl.to(
          readoutRef.current,
          { scale: 1.4, duration: 0.3, ease: "power2.out" },
          "+=0.04"
        ).to(readoutRef.current, {
          scale: 1,
          duration: 0.72,
          ease: "back.out(3)",
          onStart: () => {
            if (burstRef.current && target >= CELEBRATION_THRESHOLD) {
              spawnCelebration(burstRef.current, cx, readoutY, target);
            }
          },
        });
      }
    },
    {
      scope: dialRef,
      dependencies: [target, idle, reduce, mounted, animKey, cx, readoutY],
      revertOnUpdate: true,
    }
  );

  const liveColor = arcColor(frac);
  const display = Math.round(frac * 100);

  // 24-segment gradient track shows the red→green colour scale at low opacity.
  const gradientTrack = Array.from({ length: GRADIENT_SEGS }, (_, i) => {
    const sf = i / GRADIENT_SEGS;
    const ef = Math.min((i + 1) / GRADIENT_SEGS + 0.003, 1);
    return (
      <path
        key={i}
        d={describeArc(cx, cy, R, sf, ef)}
        fill="none"
        stroke={arcColor((i + 0.5) / GRADIENT_SEGS)}
        strokeWidth={arcW}
        strokeLinecap="butt"
        opacity={0.18}
      />
    );
  });

  if (!mounted) {
    return (
      <div className="inline-flex flex-col items-center">
        <div style={{ width: size, height: size }} />
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center">
      {/* Fixed-size dial box — caption lives outside so it can't pull the readout off-center */}
      <div
        ref={dialRef}
        className="relative overflow-visible"
        style={{ width: size, height: size }}
      >
        {/* Confetti / emoji burst layer */}
        <div
          ref={burstRef}
          className="absolute inset-0 overflow-visible pointer-events-none z-10"
          aria-hidden
        />

        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Colour-scale gradient at low opacity */}
          {gradientTrack}

          {/* Gray base track — round caps give soft terminals at both arc ends */}
          <path
            d={describeArc(cx, cy, R, 0, 1)}
            fill="none"
            stroke="var(--border)"
            strokeWidth={arcW}
            strokeLinecap="round"
            opacity={0.6}
          />

          {/* Active arc — threshold of 0.04 ensures the arc is long enough that
              the round start-cap reads as a natural rounded terminal, not a blob */}
          {frac > 0.04 && (
            <path
              d={describeArc(cx, cy, R, 0, frac)}
              fill="none"
              stroke={liveColor}
              strokeWidth={arcW}
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Centre readout — font-sans (Geist Sans) avoids the slashed zero in Geist Mono */}
        <div
          className="absolute left-1/2 flex flex-col items-center pointer-events-none"
          style={{
            top: readoutY,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            ref={readoutRef}
            className="flex flex-col items-center will-change-transform"
          >
            <span
              className="font-sans font-semibold leading-none tabular-nums"
              style={{ color: liveColor, fontSize: size * 0.245 }}
            >
              {display}
            </span>
            <span className="tnum text-[11px] leading-none text-muted-2 mt-1">
              / 100
            </span>
          </div>
        </div>
      </div>

      {idle ? (
        <div className="mt-2 text-center">
          <span className="text-xs text-muted-2">
            {caption ?? "Drop your CSV for your pipeline score"}
          </span>
        </div>
      ) : grade ? (
        <div className="mt-2 text-center">
          <span className="text-sm font-medium" style={{ color: liveColor }}>
            {grade}
          </span>
        </div>
      ) : null}
    </div>
  );
}
