"use client";

import { useActionState, useState } from "react";
import { setBudgetPlan, type ActionState } from "@/lib/actions/budget";
import { CATEGORIES, planField } from "@/lib/categories";
import { formatCurrency } from "@/lib/currency";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

/** How much you plan to spend in each category this month. */
export function BudgetPlanForm({
  month,
  planned,
}: {
  month: string;
  planned: Record<string, number>;
}) {
  const [state, formAction] = useActionState(setBudgetPlan, initialState);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATEGORIES.map(({ name }) => [name, planned[name] ? String(planned[name]) : ""])),
  );
  const [dirty, setDirty] = useState(false);
  const total = Object.values(values).reduce((sum, v) => sum + (Number(v) || 0), 0);

  return (
    <form action={formAction} onSubmit={() => setDirty(false)} className="space-y-6">
      <input type="hidden" name="month" value={month} />
      <div className="grid grid-cols-1 gap-y-2.5">
        {CATEGORIES.map(({ name, color }) => (
          <label key={name} htmlFor={planField(name)} className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
            <span className="min-w-0 flex-1 truncate text-sm text-ivory/80">{name}</span>
            <span className="relative w-32 shrink-0">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ivory/40">R</span>
              <Input
                id={planField(name)}
                name={planField(name)}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="0"
                value={values[name]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [name]: e.target.value }));
                  setDirty(true);
                }}
                className="py-2 pl-8 text-right tabular"
              />
            </span>
          </label>
        ))}
      </div>
      <FormError message={state.error} />
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-5">
        <p className="text-sm text-ivory/55">
          Total budget <span className="ml-2 text-lg font-semibold tabular text-ivory">{formatCurrency(total)}</span>
        </p>
        <div className="flex items-center gap-4">
          {state.saved && !dirty && (
            <span role="status" className="row-enter text-sm font-medium text-mint">
              ✓ Saved
            </span>
          )}
          <SubmitButton pendingText="Saving…">Save budget</SubmitButton>
        </div>
      </div>
    </form>
  );
}
