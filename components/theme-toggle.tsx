"use client";

import * as React from "react";

/**
 * Light/dark sliding pill toggle. The active theme is the `dark` class on
 * <html>, set before paint by the inline script in the layout (reads
 * localStorage, falls back to the OS preference). This button flips the class
 * and persists the choice; the knob slide and icon swap are pure CSS (`dark:`
 * variant), so there's no hydration mismatch and no flash.
 *
 * Light: sun on the left, knob slid right.  Dark: knob slid left, moon on the right.
 */
export function ThemeToggle() {
  const toggle = React.useCallback(() => {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      /* private mode / storage disabled — toggle still works for the session */
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className="relative inline-flex h-7 w-[52px] items-center rounded-full border border-border bg-surface transition-colors cursor-pointer"
    >
      {/* Sun — left, shown in light mode */}
      <svg
        className="absolute left-[7px] top-1/2 -translate-y-1/2 text-warn block dark:hidden"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>

      {/* Moon — right, shown in dark mode */}
      <svg
        className="absolute right-[7px] top-1/2 -translate-y-1/2 text-foreground hidden dark:block"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>

      {/* Sliding knob: right in light, left in dark */}
      <span
        className="absolute left-0.5 h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] translate-x-[24px] transition-transform duration-200 ease-out dark:translate-x-0 dark:bg-[#566173] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
      />
    </button>
  );
}
