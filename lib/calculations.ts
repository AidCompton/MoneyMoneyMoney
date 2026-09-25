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
