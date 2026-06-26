import { describe, it, expect } from "vitest";
import { statusFromShare, CATEGORY_MAX } from "./scoring-config";

describe("statusFromShare", () => {
  it("returns na for null, zero max, or zero score", () => {
    expect(statusFromShare(null, CATEGORY_MAX)).toBe("na");
    expect(statusFromShare(0, CATEGORY_MAX)).toBe("na");
    expect(statusFromShare(10, 0)).toBe("na");
  });

  it("uses STATUS_THRESHOLDS for traffic-light bands", () => {
    expect(statusFromShare(18.75, CATEGORY_MAX)).toBe("good");
    expect(statusFromShare(CATEGORY_MAX, CATEGORY_MAX)).toBe("good");

    expect(statusFromShare(18.7, CATEGORY_MAX)).toBe("warn");
    expect(statusFromShare(12.5, CATEGORY_MAX)).toBe("warn");

    expect(statusFromShare(12.4, CATEGORY_MAX)).toBe("bad");
    expect(statusFromShare(0.1, CATEGORY_MAX)).toBe("bad");
  });
});
