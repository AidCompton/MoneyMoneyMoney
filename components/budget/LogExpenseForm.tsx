"use client";

import { useActionState } from "react";
import { logExpense, type ActionState } from "@/lib/actions/budget";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function LogExpenseForm({ budgetId }: { budgetId: string }) {
  const [state, formAction] = useActionState(logExpense, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="budgetId" value={budgetId} />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="amount">
          Amount (R)
        </label>
        <Input id="amount" name="amount" type="number" min="1" step="1" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="description">
          Description
        </label>
        <Input id="description" name="description" placeholder="e.g. Checkers run" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="date">
          Date
        </label>
        <Input id="date" name="date" type="date" defaultValue={today} required />
      </div>
      <div className="sm:col-span-3">
        <FormError message={state.error} />
      </div>
      <div className="sm:col-span-3">
        <SubmitButton pendingText="Logging…">Log expense</SubmitButton>
      </div>
    </form>
  );
}
