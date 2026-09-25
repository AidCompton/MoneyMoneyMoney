"use client";

import { useActionState } from "react";
import { todayISO } from "@/lib/dates";
import { logExpense, type ActionState } from "@/lib/actions/budget";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function LogExpenseForm({ budgetId }: { budgetId: string }) {
  const [state, formAction] = useActionState(logExpense, initialState);
  const today = todayISO();

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="budgetId" value={budgetId} />
      <div className="sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" placeholder="e.g. Checkers run" required />
      </div>
      <div>
        <Label htmlFor="amount">Amount (R)</Label>
        <Input id="amount" name="amount" type="number" min="1" step="0.01" inputMode="decimal" required />
      </div>
      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" defaultValue={today} required />
      </div>
      <FormError message={state.error} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Logging…">Log expense</SubmitButton>
      </div>
    </form>
  );
}
