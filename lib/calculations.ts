export function goalProgressPercent(saved: number, targetAmount: number) {
  if (targetAmount <= 0) return 0;
  return Math.round((saved / targetAmount) * 100);
}

export function budgetRemaining(budgetedAmount: number, spent: number) {
  return budgetedAmount - spent;
}

export function budgetPercentSpent(budgetedAmount: number, spent: number) {
  if (budgetedAmount <= 0) return 0;
  return Math.min(100, Math.round((spent / budgetedAmount) * 100));
}

/**
 * How much still needs saving per month and per week to hit a goal by its
 * target date. Returns null when there's no date, or it has already passed.
 * Months are counted as days / 30.44 so the pace is smooth rather than
 * jumping at month boundaries.
 */
export function savingsPace(
  saved: number,
  targetAmount: number,
  targetDate: string | null,
  today: Date = new Date(),
) {
  if (!targetDate) return null;
  const [y, m, d] = targetDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((target.getTime() - start.getTime()) / 86_400_000);
  if (daysLeft <= 0) return null;

  const remaining = Math.max(0, targetAmount - saved);
  const months = Math.max(daysLeft / 30.44, 1);
  const weeks = Math.max(daysLeft / 7, 1);
  return {
    daysLeft,
    remaining,
    perMonth: Math.ceil(remaining / months),
    perWeek: Math.ceil(remaining / weeks),
  };
}

/**
 * Where one person's month went. Money paid into the shared pot is its own
 * line (not spending), so nothing is counted twice when shared and personal
 * money are added up together.
 */
export function personalFlow({
  income,
  spent,
  saved,
  contributed,
}: {
  income: number;
  spent: number;
  saved: number;
  contributed: number;
}) {
  return {
    income,
    spent,
    saved,
    contributed,
    left: income - spent - saved - contributed,
    savingsRate: income > 0 ? Math.round((saved / income) * 100) : 0,
  };
}

/**
 * The whole household's month. Contributions to the shared pot are internal
 * transfers, so they cancel out and don't appear here.
 */
export function householdFlow({
  income,
  sharedSpent,
  personalSpent,
  saved,
}: {
  income: number;
  sharedSpent: number;
  personalSpent: number;
  saved: number;
}) {
  const spent = sharedSpent + personalSpent;
  return {
    income,
    sharedSpent,
    personalSpent,
    spent,
    saved,
    left: income - spent - saved,
    savingsRate: income > 0 ? Math.round((saved / income) * 100) : 0,
  };
}

/**
 * Keeps a pie readable: past `max` slices, the smallest are folded into one
 * "Other" slice. Kept slices stay in their original order.
 */
export function foldSlices<T extends { value: number }>(
  items: T[],
  max: number,
  makeOther: (folded: T[]) => T,
): T[] {
  const visible = items.filter((i) => i.value > 0);
  if (visible.length <= max) return items;
  const keep = new Set([...visible].sort((a, b) => b.value - a.value).slice(0, max - 1));
  const folded = visible.filter((i) => !keep.has(i));
  return [...items.filter((i) => keep.has(i)), makeOther(folded)];
}

export function groceryLineTotal(quantity: number, price: number | null) {
  return price === null ? 0 : quantity * price;
}

export function groceryTotals(lines: { quantity: number; price: number | null; bought: boolean }[]) {
  let planned = 0;
  let bought = 0;
  let boughtCount = 0;
  let unpriced = 0;
  for (const line of lines) {
    const total = groceryLineTotal(line.quantity, line.price);
    planned += total;
    if (line.bought) {
      bought += total;
      boughtCount += 1;
    }
    if (line.price === null) unpriced += 1;
  }
  return { planned, bought, toBuy: planned - bought, count: lines.length, boughtCount, unpriced };
}

export function costPerDinner(total: number, dinners: number) {
  return dinners > 0 ? total / dinners : 0;
}
