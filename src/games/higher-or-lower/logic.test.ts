import { describe, expect, it } from "vitest";
import { MAX_VALUE, MIN_VALUE, isCorrectGuess, nextValue, randomValue } from "./logic";

describe("randomValue", () => {
  it("stays within the configured range", () => {
    for (let i = 0; i < 1000; i++) {
      const value = randomValue();
      expect(value).toBeGreaterThanOrEqual(MIN_VALUE);
      expect(value).toBeLessThanOrEqual(MAX_VALUE);
    }
  });
});

describe("nextValue", () => {
  it("never ties with the current value", () => {
    for (let i = 0; i < 1000; i++) {
      const current = randomValue();
      expect(nextValue(current)).not.toBe(current);
    }
  });
});

describe("isCorrectGuess", () => {
  it("scores a higher guess correct when the revealed value is greater", () => {
    expect(isCorrectGuess(50, 51, "higher")).toBe(true);
    expect(isCorrectGuess(50, 49, "higher")).toBe(false);
  });

  it("scores a lower guess correct when the revealed value is smaller", () => {
    expect(isCorrectGuess(50, 49, "lower")).toBe(true);
    expect(isCorrectGuess(50, 51, "lower")).toBe(false);
  });

  it("treats a tie as incorrect regardless of guess direction", () => {
    expect(isCorrectGuess(50, 50, "higher")).toBe(false);
    expect(isCorrectGuess(50, 50, "lower")).toBe(false);
  });
});
