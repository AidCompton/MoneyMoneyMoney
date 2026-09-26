"use client";

import { useActionState } from "react";
import { todayISO } from "@/lib/dates";
import { addContribution, type ActionState } from "@/lib/actions/goals";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function AddContributionForm({ goalId }: { goalId: string }) {
  const [state, formAction] = useActionState(addContribution, initialState);
  const today = todayISO();

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="goalId" value={goalId} />
      <div>
        <Label htmlFor="amount">Amount (R)</Label>
        <Input id="amount" name="amount" type="number" min="1" step="0.01" inputMode="decimal" required />
      </div>
      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" defaultValue={today} required />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" placeholder="e.g. Bonus contribution" />
      </div>
      <FormError message={state.error} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Adding…">Add contribution</SubmitButton>
      </div>
    </form>
  );
}
