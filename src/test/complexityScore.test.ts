import { describe, it, expect } from "vitest";

/**
 * Complexity score algorithm — mirrors LiftingCalculator logic
 */
function calculateComplexity(
  chargeKg: number | null,
  heightM: number | null,
  reachM: number | null,
  matchingCranes: number
): number {
  let score = 1;
  if (!chargeKg) return 0;

  // Weight factor
  if (chargeKg > 5000) score += 3;
  else if (chargeKg > 2000) score += 2;
  else if (chargeKg > 500) score += 1;

  // Height factor
  if (heightM) {
    if (heightM > 30) score += 3;
    else if (heightM > 15) score += 2;
    else if (heightM > 8) score += 1;
  }

  // Reach factor
  if (reachM) {
    if (reachM > 20) score += 2;
    else if (reachM > 10) score += 1;
  }

  // Few cranes available = more complex
  if (chargeKg > 0 && matchingCranes === 0) score += 2;
  else if (matchingCranes === 1) score += 1;

  return Math.min(10, score);
}

describe("Complexity Score", () => {
  it("returns 0 when no charge", () => {
    expect(calculateComplexity(null, null, null, 0)).toBe(0);
    expect(calculateComplexity(0, 10, 5, 3)).toBe(0);
  });

  it("base score is 1 for light loads", () => {
    expect(calculateComplexity(100, null, null, 5)).toBe(1);
  });

  it("adds weight factor for medium loads", () => {
    // 500 < 800 < 2000 → +1
    expect(calculateComplexity(800, null, null, 5)).toBe(2);
  });

  it("adds weight factor for heavy loads", () => {
    // 2000 < 3000 < 5000 → +2
    expect(calculateComplexity(3000, null, null, 5)).toBe(3);
  });

  it("adds weight factor for very heavy loads", () => {
    // > 5000 → +3
    expect(calculateComplexity(6000, null, null, 5)).toBe(4);
  });

  it("adds height factor", () => {
    // 800kg (+1) + 20m height (+2) = 4
    expect(calculateComplexity(800, 20, null, 5)).toBe(4);
  });

  it("adds reach factor", () => {
    // 800kg (+1) + 15m reach (+1) = 3
    expect(calculateComplexity(800, null, 15, 5)).toBe(3);
  });

  it("increases when no cranes match", () => {
    // 800kg (+1) + no cranes (+2) = 4
    expect(calculateComplexity(800, null, null, 0)).toBe(4);
  });

  it("caps at 10", () => {
    // 6000kg (+3) + 40m (+3) + 25m reach (+2) + 0 cranes (+2) = 1+3+3+2+2 = 11 → capped at 10
    expect(calculateComplexity(6000, 40, 25, 0)).toBe(10);
  });

  it("full scenario: medium complexity", () => {
    // 1500kg (+1) + 12m height (+1) + 8m reach (0) + 3 cranes (0) = 3
    expect(calculateComplexity(1500, 12, 8, 3)).toBe(3);
  });
});
