"use client";

import { useActionState } from "react";
import { logGroceryShop, type ActionState } from "@/lib/actions/groceries";
import { todayISO } from "@/lib/dates";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

/** After shopping: record what it cost as a shared Food & Toiletries expense. */
export function LogShopForm({
  suggested,
  stores,
  subcategories,
}: {
  suggested: number;
  stores: string[];
  subcategories: string[];
}) {
  const [state, formAction] = useActionState(logGroceryShop, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="shop-amount">Till slip total (R)</Label>
        <Input
          id="shop-amount"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          defaultValue={suggested > 0 ? suggested.toFixed(2) : ""}
          required
        />
      </div>
      <div>
        <Label htmlFor="shop-date">Date</Label>
        <Input id="shop-date" name="date" type="date" defaultValue={todayISO()} required />
      </div>
      <div>
        <Label htmlFor="shop-store">Store</Label>
        <Combobox id="shop-store" name="store" options={stores} placeholder="e.g. Checkers" noun="store" />
      </div>
      <div>
        <Label htmlFor="shop-sub">Sub-category</Label>
        <Combobox id="shop-sub" name="subcategory" options={subcategories} defaultValue="Groceries" noun="sub-category" />
      </div>
      <FormError message={state.error} className="sm:col-span-2" />
      <div className="flex items-center gap-4 sm:col-span-2">
        <SubmitButton pendingText="Logging…">Log as expense</SubmitButton>
        {state.saved && (
          <span role="status" className="row-enter text-sm font-medium text-mint">
            ✓ Added to the shared budget
          </span>
        )}
      </div>
    </form>
  );
}
