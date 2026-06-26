import { describe, it, expect } from "vitest";
import { parseCsvText, normalizeHeader, CsvParseError } from "./csv";
import { autoDetect } from "./column-detection";

describe("csv parsing", () => {
  it("strips BOM from file text and headers", () => {
    const csv = "\uFEFFDeal Name,Amount,Stage\nAcme,1000,Open";
    const { headers } = parseCsvText(csv);
    expect(headers[0]).toBe("Deal Name");
    expect(normalizeHeader("\uFEFFDeal Name")).toBe("Deal Name");
  });

  it("auto-maps BOM-prefixed export headers", () => {
    const csv = "\uFEFFDeal Name,Amount,Stage,Close Date\nAcme,1000,Open,6/1/2026";
    const { headers, rows } = parseCsvText(csv);
    const { mapping } = autoDetect(headers, rows);
    expect(mapping.dealName).toBe("Deal Name");
    expect(mapping.amount).toBe("Amount");
    expect(mapping.stage).toBe("Stage");
  });

  it("warns on duplicate column headers", () => {
    const csv = "Amount,Amount,Stage\n100,200,Open";
    const { warnings } = parseCsvText(csv);
    expect(warnings.some((w) => w.includes("Duplicate"))).toBe(true);
  });

  it("throws on empty headers", () => {
    expect(() => parseCsvText("\n\n")).toThrow(CsvParseError);
  });

  it("throws on malformed quoted CSV", () => {
    expect(() => parseCsvText('Deal Name,Amount\n"unclosed,1000')).toThrow(
      CsvParseError
    );
  });

  it("accepts single-column CSV for edge cases", () => {
    const { headers, rows } = parseCsvText("Deal Name\nOnly Deal");
    expect(headers).toEqual(["Deal Name"]);
    expect(rows).toHaveLength(1);
  });
});
