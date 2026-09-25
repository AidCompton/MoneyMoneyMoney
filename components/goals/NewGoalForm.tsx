"use client";

import { useActionState } from "react";
import { createGoal, type ActionState } from "@/lib/actions/goals";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function NewGoalForm() {
  const [state, formAction] = useActionState(createGoal, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">
          Goal name
        </label>
        <Input id="name" name="name" placeholder="e.g. Joint year-end savings" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="targetAmount">
          Target amount (R)
        </label>
        <Input id="targetAmount" name="targetAmount" type="number" min="1" step="1" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="targetDate">
          Target date (optional)
        </label>
        <Input id="targetDate" name="targetDate" type="date" />
      </div>
      <FormError message={state.error} />
      <SubmitButton pendingText="Creating…">Create goal</SubmitButton>
    </form>
  );
}
