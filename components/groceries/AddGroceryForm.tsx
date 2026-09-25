"use client";

import { useActionState, useState } from "react";
import { addGroceryLine, type ActionState } from "@/lib/actions/groceries";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";
import { GroceryFields, type GroceryOption } from "./GroceryFields";

const initialState: ActionState = {};

/** "+ Add a grocery", opening into the full form. */
export function AddGroceryForm({
  month,
  mealPrepId,
  options,
  label = "Add a grocery",
  startOpen = false,
}: {
  month: string;
  mealPrepId?: string;
  options: GroceryOption[];
  label?: string;
  startOpen?: boolean;
}) {
  const [state, formAction] = useActionState(addGroceryLine, initialState);
  const [open, setOpen] = useState(startOpen);
  const prefix = `add-${mealPrepId ?? "general"}`;

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        + {label}
      </Button>
    );
  }

  return (
    <form action={formAction} className="row-enter grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
      <input type="hidden" name="month" value={month} />
      {mealPrepId && <input type="hidden" name="mealPrepId" value={mealPrepId} />}
      <GroceryFields idPrefix={prefix} options={options} />
      <FormError message={state.error} className="sm:col-span-2" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton size="sm" pendingText="Adding…">
          Add to list
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Done
        </Button>
        {state.saved && (
          <span role="status" className="row-enter text-sm font-medium text-mint">
            ✓ Added
          </span>
        )}
      </div>
    </form>
  );
}
