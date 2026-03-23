import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("bg-primary", "text-white")).toBe("bg-primary text-white");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("handles undefined and null", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });
});

describe("Number formatting", () => {
  it("formats EUR correctly", () => {
    const fmt = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    });
    const result = fmt.format(1234.5);
    expect(result).toContain("1");
    expect(result).toContain("234");
    expect(result).toContain("50");
  });

  it("handles zero", () => {
    const fmt = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    });
    const result = fmt.format(0);
    expect(result).toContain("0");
  });
});
