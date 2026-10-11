"use client";

import { useActionState, useState } from "react";
import { addExpense, type ActionState } from "@/lib/actions/budget";
import { monthBounds, todayISO } from "@/lib/dates";
import { nameKey } from "@/lib/lists";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

type Category = { id: string; name: string; color: string };

/**
 * Adds an expense to the shared budget (categories are the fixed chips) or a
 * personal budget (categories are typed or picked, like everything else).
 * Sub-category and store remember what you've entered before.
 */
export function ExpenseForm({
  scope,
  month,
  categories,
  subcategories,
  stores,
}: {
  scope: "shared" | "personal";
  month: string;
  categories: Category[];
  /** Sub-category names per category, keyed by the category's name key. */
  subcategories: Record<string, string[]>;
  stores: string[];
}) {
  const [state, formAction] = useActionState(addExpense, initialState);
  const [categoryName, setCategoryName] = useState(scope === "shared" ? (categories[0]?.name ?? "") : "");
  const { first, last } = monthBounds(month);
  const today = todayISO();
  const subOptions = subcategories[nameKey(categoryName)] ?? [];

  return (
    <form
      action={formAction}
      // React clears the form after saving; keep the sub-category list in step.
      onReset={() => setCategoryName(scope === "shared" ? (categories[0]?.name ?? "") : "")}
      className="grid grid-cols-1 gap-5 sm:grid-cols-2"
    >
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="month" value={month} />

      {scope === "shared" ? (
        <fieldset className="sm:col-span-2">
          <legend className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory/55">
            Category
          </legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c, i) => (
              <label key={c.id} className="cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  value={c.id}
                  defaultChecked={i === 0}
                  onChange={() => setCategoryName(c.name)}
                  className="peer sr-only"
                />
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-ivory/70 transition-all duration-300 hover:border-white/25 hover:text-ivory peer-checked:border-gold/60 peer-checked:bg-gold/10 peer-checked:text-ivory peer-focus-visible:outline-2 peer-focus-visible:outline-gold">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="sm:col-span-2">
          <Label htmlFor={`${scope}-category`}>Category</Label>
          <Combobox
            id={`${scope}-category`}
            name="category"
            options={categories.map((c) => ({ value: c.name, color: c.color }))}
            placeholder="e.g. Clothes, Takeaways, Transport"
            noun="category"
            required
            onValueChange={setCategoryName}
          />
        </div>
      )}

      <div>
        <Label htmlFor={`${scope}-subcategory`}>Sub-category</Label>
        <Combobox
          id={`${scope}-subcategory`}
          name="subcategory"
          options={subOptions}
          placeholder={subOptions.length ? "Pick or type one" : "Type one (optional)"}
          noun="sub-category"
        />
      </div>
      <div>
        <Label htmlFor={`${scope}-store`}>Store</Label>
        <Combobox id={`${scope}-store`} name="store" options={stores} placeholder="Where from? (optional)" noun="store" />
      </div>
      <div>
        <Label htmlFor={`${scope}-amount`}>Amount (R)</Label>
        <Input id={`${scope}-amount`} name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required />
      </div>
      <div>
        <Label htmlFor={`${scope}-date`}>Date</Label>
        <Input
          id={`${scope}-date`}
          name="date"
          type="date"
          defaultValue={today.startsWith(`${month}-`) ? today : first}
          min={first}
          max={last}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${scope}-description`}>Note (optional)</Label>
        <Input id={`${scope}-description`} name="description" placeholder="Anything to remember about it" />
      </div>
      <FormError message={state.error} className="sm:col-span-2" />
      <div className="flex items-center gap-4 sm:col-span-2">
        <SubmitButton pendingText="Adding…">Add expense</SubmitButton>
        {state.saved && (
          <span role="status" className="row-enter text-sm font-medium text-mint">
            ✓ Added
          </span>
        )}
      </div>
    </form>
  );
}
