"use client";

import { useActionState } from "react";
import { createGoal, type ActionState } from "@/lib/actions/goals";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function NewGoalForm() {
  const [state, formAction] = useActionState(createGoal, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="name">Goal name</Label>
        <Input id="name" name="name" placeholder="e.g. Joint year-end savings" required />
      </div>
      <div>
        <Label htmlFor="targetAmount">Target amount (R)</Label>
        <Input id="targetAmount" name="targetAmount" type="number" min="1" step="1" placeholder="100000" required />
      </div>
      <div>
        <Label htmlFor="targetDate">Target date (optional)</Label>
        <Input id="targetDate" name="targetDate" type="date" />
      </div>
      <FormError message={state.error} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Creating…">Create goal</SubmitButton>
      </div>
    </form>
  );
}
