"use client";

import { useActionState } from "react";
import { setBudget, type ActionState } from "@/lib/actions/budget";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function SetBudgetForm({
  month,
  defaultAmount,
}: {
  month: string;
  defaultAmount?: number;
}) {
  const [state, formAction] = useActionState(setBudget, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <input type="hidden" name="month" value={month} />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="budgetedAmount">
          Grocery budget for {month} (R)
        </label>
        <Input
          id="budgetedAmount"
          name="budgetedAmount"
          type="number"
          min="1"
          step="1"
          defaultValue={defaultAmount}
          required
        />
      </div>
      <SubmitButton pendingText="Saving…">
        {defaultAmount ? "Update budget" : "Set budget"}
      </SubmitButton>
      <div className="basis-full">
        <FormError message={state.error} />
      </div>
    </form>
  );
}
