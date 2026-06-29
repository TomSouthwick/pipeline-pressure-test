import { describe, it, expect } from "vitest";
import { checkDateFormat } from "./parse";

describe("checkDateFormat", () => {
  it("treats ISO dates as unambiguous", () => {
    expect(checkDateFormat(["2026-06-04", "2026-12-31"]).ambiguous).toBe(false);
  });

  it("treats month-name dates as unambiguous", () => {
    expect(checkDateFormat(["Dec 31, 2025", "Jun 4, 2026"]).ambiguous).toBe(false);
  });

  it("is unambiguous when the data proves month/day (a second part > 12)", () => {
    // "06/25/2026" can only be M/D — confirms our default is right.
    expect(checkDateFormat(["06/25/2026", "06/04/2026"]).ambiguous).toBe(false);
  });

  it("flags ambiguity when a value proves day/month (first part > 12)", () => {
    // "25/06/2026" is day-first; "06/04/2026" then reads wrong under our M/D default.
    const r = checkDateFormat(["25/06/2026", "06/04/2026"]);
    expect(r.ambiguous).toBe(true);
    expect(r.sample).toBe("06/04/2026");
    expect(r.interpreted).toContain("June"); // read as 4 June (M/D)
  });

  it("flags ambiguity when every value is unguessable (both parts <= 12)", () => {
    const r = checkDateFormat(["06/04/2026", "05/07/2026"]);
    expect(r.ambiguous).toBe(true);
    expect(r.sample).toBe("06/04/2026");
  });

  it("ignores empty/blank cells", () => {
    expect(checkDateFormat(["", null, undefined]).ambiguous).toBe(false);
  });
});
