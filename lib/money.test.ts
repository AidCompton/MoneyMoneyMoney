import { describe, expect, it } from "vitest";
import {
  costPerDinner,
  foldSlices,
  groceryLineTotal,
  groceryTotals,
  householdFlow,
  personalFlow,
} from "./calculations";
import { crossFilter, NONE } from "./facets";
import { cleanName, nameKey } from "./lists";
import { formatMonth, isMonth, monthBounds, monthParam, shiftMonth } from "./dates";

describe("personalFlow", () => {
  it("leaves what isn't spent, saved, or paid into the shared pot", () => {
    const flow = personalFlow({ income: 30000, spent: 8000, saved: 5000, contributed: 12000 });
    expect(flow.left).toBe(5000);
    expect(flow.savingsRate).toBe(17); // 5 000 / 30 000
  });

  it("goes negative when more goes out than came in", () => {
    expect(personalFlow({ income: 1000, spent: 1500, saved: 0, contributed: 0 }).left).toBe(-500);
  });

  it("has a zero savings rate with no income", () => {
    expect(personalFlow({ income: 0, spent: 0, saved: 100, contributed: 0 }).savingsRate).toBe(0);
  });
});

describe("householdFlow", () => {
  it("adds shared and personal spending, ignoring transfers to the shared pot", () => {
    const flow = householdFlow({ income: 60000, sharedSpent: 13000, personalSpent: 14500, saved: 15000 });
    expect(flow.spent).toBe(27500);
    expect(flow.left).toBe(17500);
    expect(flow.savingsRate).toBe(25);
  });
});

describe("foldSlices", () => {
  const other = (rest: { label: string; value: number }[]) => ({
    label: "Other",
    value: rest.reduce((s, r) => s + r.value, 0),
  });

  it("leaves small pies alone", () => {
    const items = [
      { label: "a", value: 3 },
      { label: "b", value: 0 },
      { label: "c", value: 1 },
    ];
    expect(foldSlices(items, 3, other)).toBe(items);
  });

  it("folds the smallest slices into Other, keeping the rest in order", () => {
    const items = [
      { label: "a", value: 5 },
      { label: "b", value: 1 },
      { label: "c", value: 9 },
      { label: "d", value: 2 },
      { label: "e", value: 7 },
    ];
    expect(foldSlices(items, 3, other)).toEqual([
      { label: "c", value: 9 },
      { label: "e", value: 7 },
      { label: "Other", value: 8 },
    ]);
  });
});

describe("groceries", () => {
  it("prices a line as quantity × unit price, and unpriced lines as zero", () => {
    expect(groceryLineTotal(3, 24.99)).toBeCloseTo(74.97);
    expect(groceryLineTotal(2, null)).toBe(0);
  });

  it("totals planned, bought and still-to-buy", () => {
    const totals = groceryTotals([
      { quantity: 2, price: 50, bought: true },
      { quantity: 1, price: 30, bought: false },
      { quantity: 4, price: null, bought: false },
    ]);
    expect(totals).toEqual({ planned: 130, bought: 100, toBuy: 30, count: 3, boughtCount: 1, unpriced: 1 });
  });

  it("works out the cost per dinner", () => {
    expect(costPerDinner(300, 4)).toBe(75);
    expect(costPerDinner(300, 0)).toBe(0);
  });
});

describe("crossFilter", () => {
  type Row = { cat: string; store: string | null; amount: number };
  const rows: Row[] = [
    { cat: "Food", store: "Checkers", amount: 100 },
    { cat: "Food", store: "Woolies", amount: 50 },
    { cat: "Cats", store: "Checkers", amount: 30 },
    { cat: "Cats", store: null, amount: 20 },
  ];
  const dims = {
    cat: { value: (r: Row) => r.cat, label: (r: Row) => r.cat },
    store: { value: (r: Row) => r.store, label: (r: Row) => r.store ?? "" },
  };

  it("narrows rows by every active filter", () => {
    const result = crossFilter(rows, dims, { cat: "Food", store: "Checkers" }, (r) => r.amount);
    expect(result.filtered).toHaveLength(1);
    expect(result.total).toBe(100);
  });

  it("offers each dimension's options given the other filters", () => {
    const result = crossFilter(rows, dims, { store: "Checkers" }, (r) => r.amount);
    // Only categories bought at Checkers...
    expect(result.facets.cat.map((o) => [o.value, o.total])).toEqual([
      ["Food", 100],
      ["Cats", 30],
    ]);
    // ...while every store stays available to switch to.
    expect(result.facets.store.map((o) => o.value)).toEqual(["Checkers", "Woolies", NONE]);
  });

  it("can filter to rows with nothing set", () => {
    const result = crossFilter(rows, dims, { store: NONE }, (r) => r.amount);
    expect(result.filtered).toEqual([rows[3]]);
    expect(result.facets.store.find((o) => o.value === NONE)?.label).toBe("None");
  });

  it("ignores filters for dimensions that don't exist", () => {
    expect(crossFilter(rows, dims, { who: "x" }, (r) => r.amount).filtered).toHaveLength(4);
  });
});

describe("pick-list names", () => {
  it("tidies spacing and matches regardless of case", () => {
    expect(cleanName("  Pick   n Pay ")).toBe("Pick n Pay");
    expect(nameKey("  Pick   n PAY ")).toBe(nameKey("pick n pay"));
  });
});

describe("month helpers", () => {
  it("validates and defaults month params", () => {
    expect(isMonth("2026-09")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(monthParam("nonsense", new Date(2026, 8, 25))).toBe("2026-09");
  });

  it("moves across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("knows each month's first and last day", () => {
    expect(monthBounds("2028-02")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
    expect(formatMonth("2026-09")).toBe("September 2026");
  });
});
