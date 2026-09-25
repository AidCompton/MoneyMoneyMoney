import { describe, expect, it } from "vitest";
import { budgetPercentSpent, budgetRemaining, goalProgressPercent, savingsPace } from "./calculations";
import { formatDay, todayISO } from "./dates";
import { formatCurrency } from "./currency";

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

describe("savingsPace", () => {
  const today = new Date(2026, 8, 25); // 25 Sep 2026, local time

  it("spreads what's left across the time remaining", () => {
    const pace = savingsPace(25000, 100000, "2026-12-31", today);
    expect(pace).not.toBeNull();
    expect(pace!.daysLeft).toBe(97);
    expect(pace!.remaining).toBe(75000);
    // 97 days is ~3.19 months and ~13.9 weeks
    expect(pace!.perMonth).toBe(Math.ceil(75000 / (97 / 30.44)));
    expect(pace!.perWeek).toBe(Math.ceil(75000 / (97 / 7)));
  });

  it("needs nothing more once the goal is reached", () => {
    const pace = savingsPace(110000, 100000, "2026-12-31", today);
    expect(pace!.remaining).toBe(0);
    expect(pace!.perMonth).toBe(0);
  });

  it("asks for the whole remainder when less than a week is left", () => {
    const pace = savingsPace(90000, 100000, "2026-09-28", today);
    expect(pace!.perWeek).toBe(10000);
    expect(pace!.perMonth).toBe(10000);
  });

  it("returns null without a target date, or once it has passed", () => {
    expect(savingsPace(0, 100000, null, today)).toBeNull();
    expect(savingsPace(0, 100000, "2026-09-25", today)).toBeNull();
    expect(savingsPace(0, 100000, "2025-12-31", today)).toBeNull();
  });
});

describe("dates", () => {
  it("formats stored YYYY-MM-DD dates without shifting the day", () => {
    expect(formatDay("2026-12-31")).toBe("31 Dec 2026");
    expect(formatDay("2026-01-01")).toBe("1 Jan 2026");
  });

  it("uses the local calendar day for today", () => {
    expect(todayISO(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
  });
});

describe("formatCurrency", () => {
  const plain = (s: string) => s.replace(/ /g, " ");

  it("groups thousands with spaces and drops cents", () => {
    expect(plain(formatCurrency(100000))).toBe("R 100 000");
    expect(plain(formatCurrency(35500))).toBe("R 35 500");
    expect(plain(formatCurrency(999))).toBe("R 999");
    expect(plain(formatCurrency(0))).toBe("R 0");
    expect(plain(formatCurrency(1234567.6))).toBe("R 1 234 568");
  });

  it("puts the minus sign before the R", () => {
    expect(plain(formatCurrency(-2500))).toBe("-R 2 500");
  });
});
