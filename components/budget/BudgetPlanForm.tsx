"use client";

import { useActionState, useState } from "react";
import { saveBudgetPlan, type ActionState } from "@/lib/actions/budget";
import { formatCurrency } from "@/lib/currency";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

type Category = { id: string; name: string; color: string };

/**
 * How much you plan to spend in each category this month. Personal plans
 * can add a new category at the bottom; either can copy last month's amounts.
 */
export function BudgetPlanForm({
  scope,
  month,
  categories,
  planned,
  previousPlanned,
  categoryOptions = [],
}: {
  scope: "shared" | "personal";
  month: string;
  categories: Category[];
  planned: Record<string, number>;
  previousPlanned: Record<string, number>;
  /** Personal only: every personal category, for the "add a category" field. */
  categoryOptions?: Category[];
}) {
  const [state, formAction] = useActionState(saveBudgetPlan, initialState);
  const fromProps = () =>
    Object.fromEntries(categories.map((c) => [c.id, planned[c.id] ? String(planned[c.id]) : ""]));
  const [values, setValues] = useState<Record<string, string>>(fromProps);

  // When a save adds a category or changes amounts, show what was saved.
  const signature = JSON.stringify(categories.map((c) => [c.id, planned[c.id] ?? 0]));
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setValues(fromProps());
  }
  const [newAmount, setNewAmount] = useState("");
  const [dirty, setDirty] = useState(false);
  const total =
    Object.values(values).reduce((sum, v) => sum + (Number(v) || 0), 0) + (Number(newAmount) || 0);
  const hasPrevious = Object.values(previousPlanned).some((v) => v > 0);
  const unused = categoryOptions.filter((o) => !categories.some((c) => c.id === o.id));

  return (
    <form action={formAction} onSubmit={() => setDirty(false)} onReset={() => setNewAmount("")} className="space-y-6">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="month" value={month} />
      {categories.length > 0 && (
        <div className="grid grid-cols-1 gap-y-2.5">
          {categories.map(({ id, name, color }) => (
            <label key={id} htmlFor={`plan-${id}`} className="flex min-w-0 items-center gap-3">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
              <span className="min-w-0 flex-1 truncate text-sm text-ivory/80">{name}</span>
              <span className="relative w-32 shrink-0">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ivory/40">
                  R
                </span>
                <Input
                  id={`plan-${id}`}
                  name={`plan-${id}`}
                  aria-label={name}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  placeholder="0"
                  value={values[id] ?? ""}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [id]: e.target.value }));
                    setDirty(true);
                  }}
                  className="py-2 pl-8 text-right tabular"
                />
              </span>
            </label>
          ))}
        </div>
      )}

      {scope === "personal" && (
        <div className="grid grid-cols-[1fr_8rem] items-end gap-3 rounded-2xl border border-dashed border-white/15 p-4">
          <div className="min-w-0">
            <Label htmlFor="newCategory">{categories.length ? "Add a category" : "Your first category"}</Label>
            <Combobox
              id="newCategory"
              name="newCategory"
              options={unused.map((c) => ({ value: c.name, color: c.color }))}
              placeholder="e.g. Clothes"
              noun="category"
            />
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute bottom-3 left-3.5 text-sm text-ivory/40">R</span>
            <Input
              name="newAmount"
              aria-label="Planned amount for the new category"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="0"
              value={newAmount}
              onChange={(e) => {
                setNewAmount(e.target.value);
                setDirty(true);
              }}
              className="pl-8 text-right tabular"
            />
          </div>
        </div>
      )}

      <FormError message={state.error} />
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-5">
        <p className="text-sm text-ivory/55">
          Total budget <span className="ml-2 text-lg font-semibold tabular text-ivory">{formatCurrency(total)}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {state.saved && !dirty && (
            <span role="status" className="row-enter text-sm font-medium text-mint">
              ✓ Saved
            </span>
          )}
          {hasPrevious && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setValues(
                  Object.fromEntries(
                    categories.map((c) => [c.id, previousPlanned[c.id] ? String(previousPlanned[c.id]) : ""]),
                  ),
                );
                setDirty(true);
              }}
            >
              Use last month&apos;s amounts
            </Button>
          )}
          <SubmitButton pendingText="Saving…">Save budget</SubmitButton>
        </div>
      </div>
    </form>
  );
}
