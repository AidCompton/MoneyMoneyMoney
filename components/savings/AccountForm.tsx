"use client";

import { useActionState } from "react";
import { createSavingsAccount, updateSavingsAccount, type ActionState } from "@/lib/actions/savings";
import { todayISO } from "@/lib/dates";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

type Account = { id: string; name: string; institution: string | null; targetAmount: number | null };

/** New account (with its current balance), or editing an existing one's details. */
export function AccountForm({ account }: { account?: Account }) {
  const [state, formAction] = useActionState(account ? updateSavingsAccount : createSavingsAccount, initialState);
  const p = account ? "edit-account" : "account";

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {account && <input type="hidden" name="accountId" value={account.id} />}
      {!account && (
        <fieldset className="sm:col-span-2">
          <legend className="sr-only">Personal or joint account</legend>
          <div className="flex rounded-full bg-white/[0.05] p-1 ring-1 ring-inset ring-white/10">
            {[
              { value: "personal", label: "Personal" },
              { value: "joint", label: "Joint" },
            ].map((s, i) => (
              <label key={s.value} className="flex-1 cursor-pointer">
                <input type="radio" name="scope" value={s.value} defaultChecked={i === 0} className="peer sr-only" />
                <span className="block rounded-full py-2 text-center text-sm font-semibold text-ivory/60 transition-all duration-300 peer-checked:bg-mint/15 peer-checked:text-ivory peer-checked:ring-1 peer-checked:ring-inset peer-checked:ring-mint/40 peer-focus-visible:outline-2 peer-focus-visible:outline-mint">
                  {s.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <Label htmlFor={`${p}-name`}>Account name</Label>
        <Input id={`${p}-name`} name="name" defaultValue={account?.name} placeholder="e.g. Emergency fund" required />
      </div>
      <div>
        <Label htmlFor={`${p}-institution`}>Bank (optional)</Label>
        <Input id={`${p}-institution`} name="institution" defaultValue={account?.institution ?? ""} placeholder="e.g. Capitec" />
      </div>
      <div>
        <Label htmlFor={`${p}-target`}>Target (optional, R)</Label>
        <Input
          id={`${p}-target`}
          name="targetAmount"
          type="number"
          min="1"
          step="1"
          defaultValue={account?.targetAmount ?? ""}
          placeholder="e.g. 30000"
        />
      </div>
      {!account && (
        <>
          <div>
            <Label htmlFor={`${p}-opening`}>Balance right now (R)</Label>
            <Input id={`${p}-opening`} name="openingBalance" type="number" min="0" step="0.01" placeholder="0" />
          </div>
          <input type="hidden" name="openingDate" value={todayISO()} />
        </>
      )}
      <FormError message={state.error} className="sm:col-span-2" />
      <div className="flex items-center gap-4 sm:col-span-2">
        <SubmitButton pendingText="Saving…" variant={account ? "secondary" : "primary"}>
          {account ? "Save changes" : "Add account"}
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
