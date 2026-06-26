import { describe, it, expect } from "vitest";
import { getPeriodBounds, isCloseDateInPeriod } from "./quota-period";

const JUN_25_2026 = new Date(2026, 5, 25);

describe("getPeriodBounds", () => {
  it("returns Q2 2026 for June", () => {
    const bounds = getPeriodBounds("quarter", JUN_25_2026);
    expect(bounds.label).toBe("Q2 2026");
    expect(bounds.start).toEqual(new Date(2026, 3, 1));
    expect(bounds.end).toEqual(new Date(2026, 5, 30));
  });

  it("returns Q1 at year boundary", () => {
    const bounds = getPeriodBounds("quarter", new Date(2026, 0, 15));
    expect(bounds.label).toBe("Q1 2026");
    expect(bounds.start).toEqual(new Date(2026, 0, 1));
    expect(bounds.end).toEqual(new Date(2026, 2, 31));
  });

  it("returns Q4 at year end", () => {
    const bounds = getPeriodBounds("quarter", new Date(2026, 11, 20));
    expect(bounds.label).toBe("Q4 2026");
    expect(bounds.end).toEqual(new Date(2026, 11, 31));
  });

  it("returns calendar year bounds", () => {
    const bounds = getPeriodBounds("year", JUN_25_2026);
    expect(bounds.label).toBe("2026");
    expect(bounds.start).toEqual(new Date(2026, 0, 1));
    expect(bounds.end).toEqual(new Date(2026, 11, 31));
  });
});

describe("isCloseDateInPeriod", () => {
  it("includes dates inside the current quarter", () => {
    expect(isCloseDateInPeriod(new Date(2026, 5, 15), "quarter", JUN_25_2026)).toBe(
      true
    );
  });

  it("excludes dates on the next quarter", () => {
    expect(isCloseDateInPeriod(new Date(2026, 6, 1), "quarter", JUN_25_2026)).toBe(
      false
    );
  });

  it("includes quarter boundary days", () => {
    expect(isCloseDateInPeriod(new Date(2026, 3, 1), "quarter", JUN_25_2026)).toBe(
      true
    );
    expect(isCloseDateInPeriod(new Date(2026, 5, 30), "quarter", JUN_25_2026)).toBe(
      true
    );
  });

  it("includes any date in the calendar year for yearly mode", () => {
    expect(isCloseDateInPeriod(new Date(2026, 8, 15), "year", JUN_25_2026)).toBe(
      true
    );
    expect(isCloseDateInPeriod(new Date(2025, 11, 31), "year", JUN_25_2026)).toBe(
      false
    );
  });
});
