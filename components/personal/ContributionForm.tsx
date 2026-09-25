"use client";

import { useActionState } from "react";
import { addSharedContribution, type ActionState } from "@/lib/actions/personal";
import { monthBounds, todayISO } from "@/lib/dates";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function ContributionForm({ month }: { month: string }) {
  const [state, formAction] = useActionState(addSharedContribution, initialState);
  const { first, last } = monthBounds(month);
  const today = todayISO();

  return (
    <form action={formAction} className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="contribution-amount">Amount (R)</Label>
        <Input id="contribution-amount" name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required />
      </div>
      <div>
        <Label htmlFor="contribution-date">Date</Label>
        <Input
          id="contribution-date"
          name="date"
          type="date"
          defaultValue={today.startsWith(`${month}-`) ? today : first}
          min={first}
          max={last}
          required
        />
      </div>
      <div className="col-span-2">
        <Label htmlFor="contribution-note">Note (optional)</Label>
        <Input id="contribution-note" name="note" placeholder="e.g. Monthly transfer to the joint account" />
      </div>
      <FormError message={state.error} className="col-span-2" />
      <div className="col-span-2">
        <SubmitButton pendingText="Saving…">Record payment</SubmitButton>
      </div>
    </form>
  );
}
