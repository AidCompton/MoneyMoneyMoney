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
