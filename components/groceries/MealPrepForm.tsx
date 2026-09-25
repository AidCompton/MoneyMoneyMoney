"use client";

import { useActionState } from "react";
import { createMealPrep, updateMealPrep, type ActionState } from "@/lib/actions/groceries";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

type MealPrep = { id: string; name: string; dinners: number; cookOn: string | null; notes: string };

/**
 * Plan a meal prep, or edit one. Picking a meal you've prepped before copies
 * its ingredients into this month's list.
 */
export function MealPrepForm({
  month,
  options = [],
  mealPrep,
}: {
  month: string;
  options?: string[];
  mealPrep?: MealPrep;
}) {
  const [state, formAction] = useActionState(mealPrep ? updateMealPrep : createMealPrep, initialState);
  const p = mealPrep ? `prep-${mealPrep.id}` : "prep-new";

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="month" value={month} />
      {mealPrep && <input type="hidden" name="mealPrepId" value={mealPrep.id} />}
      <div className="sm:col-span-2">
        <Label htmlFor={`${p}-name`}>Meal</Label>
        {mealPrep ? (
          <Input id={`${p}-name`} name="name" defaultValue={mealPrep.name} required />
        ) : (
          <Combobox id={`${p}-name`} name="name" options={options} placeholder="e.g. Chicken stir-fry" noun="meal" required />
        )}
        {!mealPrep && options.length > 0 && (
          <p className="mt-2 text-xs text-ivory/40">Pick one you&apos;ve made before to copy its ingredients.</p>
        )}
      </div>
      <div>
        <Label htmlFor={`${p}-dinners`}>Dinners it covers</Label>
        <Input id={`${p}-dinners`} name="dinners" type="number" min="1" step="1" defaultValue={mealPrep?.dinners ?? 4} required />
      </div>
      <div>
        <Label htmlFor={`${p}-cookOn`}>Cook on</Label>
        <Input id={`${p}-cookOn`} name="cookOn" type="date" defaultValue={mealPrep?.cookOn ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${p}-notes`}>Notes (optional)</Label>
        <Textarea id={`${p}-notes`} name="notes" rows={2} defaultValue={mealPrep?.notes ?? ""} placeholder="Recipe link, who cooks, tubs needed…" />
      </div>
      <FormError message={state.error} className="sm:col-span-2" />
      <div className="flex items-center gap-4 sm:col-span-2">
        <SubmitButton pendingText="Saving…" variant={mealPrep ? "secondary" : "primary"}>
          {mealPrep ? "Save meal prep" : "Plan meal prep"}
        </SubmitButton>
        {state.saved && (
          <span role="status" className="row-enter text-sm font-medium text-mint">
            ✓ {mealPrep ? "Saved" : "Planned"}
          </span>
        )}
      </div>
    </form>
  );
}
