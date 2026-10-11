"use client";

import { useActionState } from "react";
import { addSavingsTransaction, type ActionState } from "@/lib/actions/savings";
import { monthBounds, todayISO } from "@/lib/dates";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Label, Select } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

/** A deposit into or withdrawal from one of your savings accounts. */
export function TransactionForm({
  accounts,
  tags,
  month,
}: {
  accounts: { id: string; name: string }[];
  tags: string[];
  month?: string;
}) {
  const [state, formAction] = useActionState(addSavingsTransaction, initialState);
  const today = todayISO();
  const bounds = month ? monthBounds(month) : null;
  const defaultDate = !bounds || today.startsWith(`${month}-`) ? today : bounds.first;

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <fieldset className="sm:col-span-2">
        <legend className="sr-only">Deposit or withdrawal</legend>
        <div className="flex rounded-full bg-white/[0.05] p-1 ring-1 ring-inset ring-white/10">
          {[
            { value: "in", label: "Deposit" },
            { value: "out", label: "Withdrawal" },
          ].map((d, i) => (
            <label key={d.value} className="flex-1 cursor-pointer">
              <input type="radio" name="direction" value={d.value} defaultChecked={i === 0} className="peer sr-only" />
              <span className="block rounded-full py-2 text-center text-sm font-semibold text-ivory/60 transition-all duration-300 peer-checked:bg-mint/15 peer-checked:text-ivory peer-checked:ring-1 peer-checked:ring-inset peer-checked:ring-mint/40 peer-focus-visible:outline-2 peer-focus-visible:outline-mint">
                {d.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {accounts.length === 1 ? (
        <input type="hidden" name="accountId" value={accounts[0].id} />
      ) : (
        <div className="sm:col-span-2">
          <Label htmlFor="tx-account">Account</Label>
          <Select id="tx-account" name="accountId" required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div>
        <Label htmlFor="tx-amount">Amount (R)</Label>
        <Input id="tx-amount" name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required />
      </div>
      <div>
        <Label htmlFor="tx-date">Date</Label>
        <Input
          id="tx-date"
          name="date"
          type="date"
          defaultValue={defaultDate}
          min={bounds?.first}
          max={bounds?.last}
          required
        />
      </div>
      <div>
        <Label htmlFor="tx-tag">Sub-category</Label>
        <Combobox id="tx-tag" name="tag" options={tags} placeholder="e.g. Salary, Bonus, Interest" noun="sub-category" />
      </div>
      <div>
        <Label htmlFor="tx-note">Note (optional)</Label>
        <Input id="tx-note" name="note" />
      </div>
      <FormError message={state.error} className="sm:col-span-2" />
      <div className="flex items-center gap-4 sm:col-span-2">
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
        {state.saved && (
          <span role="status" className="row-enter text-sm font-medium text-mint">
            ✓ Saved
          </span>
        )}
      </div>
    </form>
  );
}
