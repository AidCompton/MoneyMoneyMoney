"use client";

import { useActionState } from "react";
import { setBudget, type ActionState } from "@/lib/actions/budget";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function SetBudgetForm({
  month,
  monthLabel,
  defaultAmount,
}: {
  month: string;
  monthLabel: string;
  defaultAmount?: number;
}) {
  const [state, formAction] = useActionState(setBudget, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <input type="hidden" name="month" value={month} />
      <div className="min-w-0 flex-1 basis-56">
        <Label htmlFor="budgetedAmount">Grocery budget for {monthLabel} (R)</Label>
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
      <SubmitButton pendingText="Saving…" variant={defaultAmount ? "secondary" : "primary"}>
        {defaultAmount ? "Update budget" : "Set budget"}
      </SubmitButton>
      <FormError message={state.error} className="basis-full" />
    </form>
  );
}
