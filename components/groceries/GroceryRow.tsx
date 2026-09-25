"use client";

import { useActionState, useOptimistic, useRef, useState } from "react";
import { deleteGroceryLine, toggleGroceryBought, updateGroceryLine, type ActionState } from "@/lib/actions/groceries";
import { formatCurrency, formatPrice } from "@/lib/currency";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsap";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";
import { GroceryFields, type GroceryOption } from "./GroceryFields";

export type GroceryLine = {
  id: string;
  itemName: string;
  size: string | null;
  quantity: number;
  price: number | null;
  total: number;
  comment: string | null;
  bought: boolean;
};

const initialState: ActionState = {};

/**
 * One line on the list. Ticking it off happens instantly (the server catches
 * up behind the scenes) with a strike-through that draws across the name.
 */
export function GroceryRow({ line, options }: { line: GroceryLine; options: GroceryOption[] }) {
  const [bought, setBought] = useOptimistic(line.bought);
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await updateGroceryLine(prev, fd);
    if (result.saved) setEditing(false);
    return result;
  }, initialState);
  const row = useRef<HTMLLIElement>(null);
  const firstRender = useRef(true);

  useGSAP(
    () => {
      if (firstRender.current) {
        firstRender.current = false;
        return;
      }
      if (prefersReducedMotion()) return;
      if (bought) {
        gsap.fromTo("[data-strike]", { backgroundSize: "0% 1.5px" }, { backgroundSize: "100% 1.5px", duration: 0.6, ease: "power3.out" });
        gsap.fromTo("[data-check]", { scale: 0.3, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.6, ease: "back.out(3)" });
      }
    },
    { scope: row, dependencies: [bought] },
  );

  if (editing) {
    return (
      <li className="row-enter py-3">
        <form action={formAction} className="grid grid-cols-1 gap-4 rounded-2xl border border-gold/25 bg-white/[0.03] p-4 sm:grid-cols-2">
          <input type="hidden" name="lineId" value={line.id} />
          <GroceryFields
            idPrefix={`edit-${line.id}`}
            options={options}
            defaults={{
              name: line.itemName,
              size: line.size,
              quantity: line.quantity,
              price: line.price,
              comment: line.comment,
            }}
          />
          <FormError message={state.error} className="sm:col-span-2" />
          <div className="flex gap-3 sm:col-span-2">
            <SubmitButton size="sm" pendingText="Saving…">
              Save
            </SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li ref={row} className="row-enter flex items-center gap-3 py-3 sm:gap-4">
      <form
        action={async () => {
          // Form actions run in a transition, so the tick shows immediately
          // and holds until the refreshed list arrives.
          setBought(!bought);
          await toggleGroceryBought(line.id);
        }}
      >
        <button
          type="submit"
          aria-label={bought ? `Put ${line.itemName} back on the list` : `Mark ${line.itemName} as bought`}
          aria-pressed={bought}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300 ${
            bought ? "border-mint bg-mint text-night shadow-[0_0_16px_rgb(79_227_165/0.6)]" : "border-ivory/25 hover:border-mint"
          }`}
        >
          {bought && (
            <svg data-check viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
              <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </form>
      <div className={`min-w-0 flex-1 transition-opacity duration-500 ${bought ? "opacity-45" : ""}`}>
        <p className="flex min-w-0 items-center gap-2">
          <span className="line-clamp-2 min-w-0 break-words font-medium sm:line-clamp-1">
            {/* The strike-through is a background line, so it draws across
                every line of a name that wraps. */}
            <span
              data-strike
              className="bg-no-repeat [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
              style={{
                backgroundImage: "linear-gradient(#4fe3a5, #4fe3a5)",
                backgroundPosition: "0 55%",
                backgroundSize: bought ? "100% 1.5px" : "0% 1.5px",
              }}
            >
              {line.itemName}
            </span>
          </span>
          {line.size && (
            <span className="hidden shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold text-ivory/60 sm:inline">
              {line.size}
            </span>
          )}
        </p>
        <p className="truncate text-sm text-ivory/45">
          {line.size && <span className="sm:hidden">{line.size} · </span>}
          {line.quantity} × {line.price !== null ? formatPrice(line.price) : "no price"}
          {line.comment && ` · ${line.comment}`}
        </p>
      </div>
      <span className={`shrink-0 font-semibold tabular ${bought ? "text-ivory/45" : ""}`}>
        {line.price !== null ? formatCurrency(line.total) : "—"}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${line.itemName}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ivory/35 transition-colors hover:bg-white/[0.07] hover:text-gold"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="m13.5 3.5 3 3L7 16H4v-3l9.5-9.5Z" strokeLinejoin="round" />
        </svg>
      </button>
      <form action={deleteGroceryLine.bind(null, line.id)}>
        <ConfirmButton icon label={`Remove ${line.itemName}`} />
      </form>
    </li>
  );
}
