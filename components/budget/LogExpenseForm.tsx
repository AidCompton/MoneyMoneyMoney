"use client";

import { useActionState } from "react";
import { endOfMonth, format, parse } from "date-fns";
import { todayISO } from "@/lib/dates";
import { logExpense, type ActionState } from "@/lib/actions/budget";
import { CATEGORIES } from "@/lib/categories";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function LogExpenseForm({ month }: { month: string }) {
  const [state, formAction] = useActionState(logExpense, initialState);
  const first = `${month}-01`;
  const last = format(endOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd");
  const today = todayISO();
  const defaultDate = today.startsWith(`${month}-`) ? today : first;

  return (
    <form action={formAction} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <input type="hidden" name="month" value={month} />
      <fieldset className="sm:col-span-2">
        <legend className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory/55">
          Category
        </legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(({ name, color }, i) => (
            <label key={name} className="cursor-pointer">
              <input
                type="radio"
                name="category"
                value={name}
                defaultChecked={i === 0}
                className="peer sr-only"
              />
              <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-ivory/70 transition-all duration-300 hover:border-white/25 hover:text-ivory peer-checked:border-gold/60 peer-checked:bg-gold/10 peer-checked:text-ivory peer-focus-visible:outline-2 peer-focus-visible:outline-gold">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
                {name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <Label htmlFor="amount">Amount (R)</Label>
        <Input id="amount" name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required />
      </div>
      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" defaultValue={defaultDate} min={first} max={last} required />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="description">What was it? (optional)</Label>
        <Input id="description" name="description" placeholder="e.g. Checkers run" />
      </div>
      <FormError message={state.error} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Adding…">Add expense</SubmitButton>
      </div>
    </form>
  );
}
