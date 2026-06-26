"use client";

import * as React from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "motion/react";

gsap.registerPlugin(useGSAP);

const STATIC_FLUID_BG =
  "linear-gradient(135deg, rgba(220, 38, 38, 0.18), rgba(180, 83, 9, 0.15), rgba(22, 163, 74, 0.15), rgba(37, 99, 235, 0.2))";

interface SiteHeaderProps {
  onHome: () => void;
}

export function SiteHeader({ onHome }: SiteHeaderProps) {
  const pillRef = React.useRef<HTMLButtonElement>(null);
  const fluidRef = React.useRef<HTMLSpanElement>(null);
  const blob1Ref = React.useRef<HTMLSpanElement>(null);
  const blob2Ref = React.useRef<HTMLSpanElement>(null);
  const blob3Ref = React.useRef<HTMLSpanElement>(null);
  const blob4Ref = React.useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const fluidTweensRef = React.useRef<gsap.core.Tween[]>([]);

  useGSAP(
    (_, contextSafe) => {
      const pill = pillRef.current;
      const fluid = fluidRef.current;
      const blob1 = blob1Ref.current;
      const blob2 = blob2Ref.current;
      const blob3 = blob3Ref.current;
      const blob4 = blob4Ref.current;
      if (!pill || !fluid || !contextSafe) return;

      fluidTweensRef.current = [];

      if (reducedMotion) {
        gsap.set(pill, { opacity: 1 });
        gsap.set(fluid, { opacity: 1 });
        [blob1, blob2, blob3, blob4].forEach((b) => {
          if (b) gsap.set(b, { opacity: 0 });
        });
        return;
      }

      gsap.set(pill, { opacity: 0 });
      gsap.to(pill, { opacity: 1, duration: 0.4, ease: "power2.out" });

      if (blob1) {
        gsap.set(blob1, { left: "18%", top: "45%", x: 0, y: 0, scale: 1 });
        fluidTweensRef.current.push(
          gsap.to(blob1, {
            x: 34,
            y: 20,
            scale: 1.16,
            duration: 4.2,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          })
        );
      }

      if (blob2) {
        gsap.set(blob2, { left: "72%", top: "40%", x: 0, y: 0, scale: 1 });
        fluidTweensRef.current.push(
          gsap.to(blob2, {
            x: -30,
            y: 24,
            scale: 0.88,
            duration: 5.2,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          })
        );
      }

      if (blob3) {
        gsap.set(blob3, { left: "45%", top: "65%", x: 0, y: 0, scale: 1 });
        fluidTweensRef.current.push(
          gsap.to(blob3, {
            x: 40,
            y: -14,
            scale: 1.14,
            duration: 3.2,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          })
        );
      }

      if (blob4) {
        gsap.set(blob4, { left: "55%", top: "25%", x: 0, y: 0, scale: 1 });
        fluidTweensRef.current.push(
          gsap.to(blob4, {
            x: -26,
            y: 28,
            scale: 1.12,
            duration: 5.5,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          })
        );
      }

      const setFluidSpeed = (scale: number) => {
        fluidTweensRef.current.forEach((t) => t.timeScale(scale));
      };

      const onEnter = contextSafe(() => setFluidSpeed(1.7));
      const onLeave = contextSafe(() => setFluidSpeed(1));

      const onMouseDown = contextSafe(() => {
        gsap.to(fluid, { opacity: 0.55, duration: 0.08, ease: "power2.in" });
      });

      const onMouseUp = contextSafe(() => {
        gsap.to(fluid, { opacity: 1, duration: 0.15, ease: "power2.out" });
      });

      pill.addEventListener("mouseenter", onEnter);
      pill.addEventListener("mouseleave", onLeave);
      pill.addEventListener("mousedown", onMouseDown);
      pill.addEventListener("mouseup", onMouseUp);

      return () => {
        pill.removeEventListener("mouseenter", onEnter);
        pill.removeEventListener("mouseleave", onLeave);
        pill.removeEventListener("mousedown", onMouseDown);
        pill.removeEventListener("mouseup", onMouseUp);
        fluidTweensRef.current = [];
      };
    },
    { scope: pillRef, dependencies: [reducedMotion], revertOnUpdate: true }
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-center px-5 py-3.5 sm:px-6 sm:py-4">
        <button
          ref={pillRef}
          type="button"
          onClick={onHome}
          className="relative overflow-hidden rounded-full border border-border bg-background/80 text-lg font-semibold tracking-tight text-foreground backdrop-blur-sm transition-colors hover:text-accent cursor-pointer shadow-sm"
          aria-label="Pipeline Pressure Test — back to start"
        >
          <span
            ref={fluidRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
            style={reducedMotion ? { background: STATIC_FLUID_BG } : undefined}
          >
            {!reducedMotion && (
              <>
                <span
                  ref={blob1Ref}
                  className="absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--bad)] opacity-[0.36] blur-2xl"
                  style={{ left: "18%", top: "45%" }}
                />
                <span
                  ref={blob2Ref}
                  className="absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--warn)] opacity-[0.38] blur-2xl"
                  style={{ left: "72%", top: "40%" }}
                />
                <span
                  ref={blob3Ref}
                  className="absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--good)] opacity-[0.34] blur-2xl"
                  style={{ left: "45%", top: "65%" }}
                />
                <span
                  ref={blob4Ref}
                  className="absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] opacity-[0.4] blur-2xl"
                  style={{ left: "55%", top: "25%" }}
                />
              </>
            )}
          </span>
          <span className="relative z-10 block px-5 py-2.5 sm:px-6 sm:py-3 sm:text-xl [text-shadow:0_1px_2px_color-mix(in_srgb,var(--background)_85%,transparent),0_0_12px_color-mix(in_srgb,var(--background)_60%,transparent)]">
            Pipeline Pressure Test
          </span>
        </button>
      </div>
    </header>
  );
}
