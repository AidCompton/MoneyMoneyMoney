"use client";

import { useActionState } from "react";
import { addContribution, type ActionState } from "@/lib/actions/goals";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function AddContributionForm({ goalId }: { goalId: string }) {
  const [state, formAction] = useActionState(addContribution, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="goalId" value={goalId} />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="amount">
          Amount (R)
        </label>
        <Input id="amount" name="amount" type="number" min="1" step="1" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="date">
          Date
        </label>
        <Input id="date" name="date" type="date" defaultValue={today} required />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="note">
          Note (optional)
        </label>
        <Input id="note" name="note" placeholder="e.g. Bonus contribution" />
      </div>
      <div className="sm:col-span-2">
        <FormError message={state.error} />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Adding…">Add contribution</SubmitButton>
      </div>
    </form>
  );
}
