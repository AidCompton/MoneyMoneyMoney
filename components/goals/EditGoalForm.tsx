"use client";

import { useActionState } from "react";
import { updateGoal, type ActionState } from "@/lib/actions/goals";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function EditGoalForm({
  goal,
}: {
  goal: { id: string; name: string; targetAmount: number; targetDate: string | null };
}) {
  const [state, formAction] = useActionState(updateGoal, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <input type="hidden" name="goalId" value={goal.id} />
      <div>
        <Label htmlFor="edit-name">Goal name</Label>
        <Input id="edit-name" name="name" defaultValue={goal.name} required />
      </div>
      <div>
        <Label htmlFor="edit-targetAmount">Target (R)</Label>
        <Input
          id="edit-targetAmount"
          name="targetAmount"
          type="number"
          min="1"
          step="1"
          defaultValue={goal.targetAmount}
          required
        />
      </div>
      <div>
        <Label htmlFor="edit-targetDate">Target date</Label>
        <Input id="edit-targetDate" name="targetDate" type="date" defaultValue={goal.targetDate ?? ""} />
      </div>
      <FormError message={state.error} className="sm:col-span-3" />
      <div className="flex items-center gap-4 sm:col-span-3">
        <SubmitButton variant="secondary" pendingText="Saving…">
          Save changes
        </SubmitButton>
        {state.saved && (
          <span role="status" className="row-enter text-sm font-medium text-mint">
            ✓ Updated
          </span>
        )}
      </div>
    </form>
  );
}
