import { describe, expect, it } from "vitest";
import { budgetPercentSpent, budgetRemaining, goalProgressPercent } from "./calculations";

describe("goalProgressPercent", () => {
  it("computes a rounded percentage of target reached", () => {
    expect(goalProgressPercent(25000, 100000)).toBe(25);
    expect(goalProgressPercent(100000, 100000)).toBe(100);
    expect(goalProgressPercent(0, 100000)).toBe(0);
  });

  it("can exceed 100% once the goal is overshot", () => {
    expect(goalProgressPercent(120000, 100000)).toBe(120);
  });

  it("returns 0 for a non-positive target instead of dividing by zero", () => {
    expect(goalProgressPercent(500, 0)).toBe(0);
  });
});

describe("budgetRemaining", () => {
  it("returns the unspent balance", () => {
    expect(budgetRemaining(5000, 3200)).toBe(1800);
  });

  it("goes negative once spending exceeds the budget", () => {
    expect(budgetRemaining(5000, 5400)).toBe(-400);
  });
});

describe("budgetPercentSpent", () => {
  it("computes a rounded percentage of the budget spent", () => {
    expect(budgetPercentSpent(5000, 2500)).toBe(50);
  });

  it("caps at 100% even when over budget", () => {
    expect(budgetPercentSpent(5000, 7500)).toBe(100);
  });

  it("returns 0 for a non-positive budget instead of dividing by zero", () => {
    expect(budgetPercentSpent(0, 500)).toBe(0);
  });
});
