"use client";

import { useActionState } from "react";
import { addIncome, type ActionState } from "@/lib/actions/personal";
import { monthBounds, todayISO } from "@/lib/dates";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function IncomeForm({ month, sources }: { month: string; sources: string[] }) {
  const [state, formAction] = useActionState(addIncome, initialState);
  const { first, last } = monthBounds(month);
  const today = todayISO();

  return (
    <form action={formAction} className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <Label htmlFor="income-source">Source</Label>
        <Combobox id="income-source" name="source" options={sources} placeholder="e.g. Salary" noun="source" required />
      </div>
      <div>
        <Label htmlFor="income-amount">Amount (R)</Label>
        <Input id="income-amount" name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required />
      </div>
      <div>
        <Label htmlFor="income-date">Date</Label>
        <Input
          id="income-date"
          name="date"
          type="date"
          defaultValue={today.startsWith(`${month}-`) ? today : first}
          min={first}
          max={last}
          required
        />
      </div>
      <div className="col-span-2">
        <Label htmlFor="income-note">Note (optional)</Label>
        <Input id="income-note" name="note" placeholder="e.g. Includes overtime" />
      </div>
      <FormError message={state.error} className="col-span-2" />
      <div className="col-span-2">
        <SubmitButton pendingText="Adding…">Add income</SubmitButton>
      </div>
    </form>
  );
}
