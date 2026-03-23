import { describe, it, expect } from "vitest";

// Test FEC format helpers (extracted logic)
function fecDate(d: string | null | undefined): string {
  if (!d) return "";
  try {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  } catch {
    return "";
  }
}

function fecAmount(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

describe("FEC Export Helpers", () => {
  describe("fecDate", () => {
    it("formats ISO date to YYYYMMDD", () => {
      expect(fecDate("2026-03-15")).toBe("20260315");
    });

    it("handles datetime strings", () => {
      expect(fecDate("2026-01-01T14:30:00Z")).toBe("20260101");
    });

    it("returns empty for null/undefined", () => {
      expect(fecDate(null)).toBe("");
      expect(fecDate(undefined)).toBe("");
      expect(fecDate("")).toBe("");
    });
  });

  describe("fecAmount", () => {
    it("formats with comma decimal separator", () => {
      expect(fecAmount(1234.56)).toBe("1234,56");
    });

    it("formats zero", () => {
      expect(fecAmount(0)).toBe("0,00");
    });

    it("adds trailing zeros", () => {
      expect(fecAmount(100)).toBe("100,00");
    });

    it("rounds to 2 decimals", () => {
      expect(fecAmount(99.999)).toBe("100,00");
    });
  });
});
