"use client";

import * as React from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";

gsap.registerPlugin(useGSAP);

interface SiteHeaderProps {
  onHome: () => void;
}

export function SiteHeader({ onHome }: SiteHeaderProps) {
  const wordmarkRef = React.useRef<HTMLButtonElement>(null);
  const pillRef = React.useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  useGSAP(
    (_, contextSafe) => {
      const wordmark = wordmarkRef.current;
      const pill = pillRef.current;
      if (!wordmark || !pill || !contextSafe) return;

      gsap.set(pill, { transformOrigin: "center center" });

      if (reducedMotion) {
        gsap.set(wordmark, { opacity: 1 });
        return;
      }

      gsap.set(wordmark, { opacity: 0 });
      gsap.fromTo(
        wordmark,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: "power2.out" }
      );

      const onEnter = contextSafe(() => {
        gsap.to(pill, {
          scale: 1.05,
          duration: 0.28,
          ease: "back.out(1.5)",
          overwrite: "auto",
        });
      });

      const onLeave = contextSafe(() => {
        gsap.to(pill, {
          scale: 1,
          duration: 0.3,
          ease: "power2.out",
          overwrite: "auto",
        });
      });

      wordmark.addEventListener("mouseenter", onEnter);
      wordmark.addEventListener("mouseleave", onLeave);

      return () => {
        wordmark.removeEventListener("mouseenter", onEnter);
        wordmark.removeEventListener("mouseleave", onLeave);
      };
    },
    { scope: wordmarkRef, dependencies: [reducedMotion], revertOnUpdate: true }
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-center px-5 pb-3.5 pt-6 sm:px-6 sm:pb-4 sm:pt-8">
        <button
          ref={wordmarkRef}
          type="button"
          onClick={onHome}
          className={cn(
            "font-display cursor-pointer font-semibold tracking-tight",
            !reducedMotion && "opacity-0"
          )}
          aria-label="Pipeline Pressure Test — back to start"
        >
          <span
            ref={pillRef}
            className="wordmark-pill inline-flex px-6 py-2.5 text-xl will-change-transform sm:px-7 sm:py-3 sm:text-2xl"
          >
            <span className="inline-grid [grid-template-areas:'stack']">
              <span
                className="text-[#d1d1d6] [grid-area:stack]"
                aria-hidden
              >
                Pipeline Pressure Test
              </span>
              <span
                className={cn(
                  "text-gradient-pipeline [grid-area:stack]",
                  !reducedMotion && "text-gradient-pipeline-reveal"
                )}
                aria-hidden
              >
                Pipeline Pressure Test
              </span>
            </span>
          </span>
        </button>
      </div>
    </header>
  );
}
