"use client";

import { useRef } from "react";
import { Combobox } from "@/components/ui/Combobox";
import { formatPrice } from "@/lib/currency";
import { Input, Label } from "@/components/ui/Input";

export type GroceryOption = { name: string; size: string | null; price: number | null };
export type GroceryDefaults = {
  name?: string;
  size?: string | null;
  quantity?: number;
  price?: number | null;
  comment?: string | null;
};

/**
 * Name, size, quantity, price and comment for one grocery. Picking a grocery
 * you've bought before fills in its last size and price.
 */
export function GroceryFields({
  idPrefix,
  options,
  defaults = {},
}: {
  idPrefix: string;
  options: GroceryOption[];
  defaults?: GroceryDefaults;
}) {
  const size = useRef<HTMLInputElement>(null);
  const price = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-name`}>Grocery</Label>
        <Combobox
          id={`${idPrefix}-name`}
          name="name"
          defaultValue={defaults.name ?? ""}
          options={options.map((o) => ({
            value: o.name,
            hint: [o.size, o.price !== null ? formatPrice(o.price) : null].filter(Boolean).join(" · ") || undefined,
          }))}
          placeholder="e.g. Chicken breasts"
          noun="grocery"
          required
          onPick={(picked) => {
            const known = options.find((o) => o.name === picked.value);
            if (!known) return;
            if (size.current && !size.current.value && known.size) size.current.value = known.size;
            if (price.current && !price.current.value && known.price !== null) price.current.value = String(known.price);
          }}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-size`}>Size</Label>
        <Input ref={size} id={`${idPrefix}-size`} name="size" defaultValue={defaults.size ?? ""} placeholder="e.g. 1kg, 2L" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-quantity`}>Qty</Label>
          <Input
            id={`${idPrefix}-quantity`}
            name="quantity"
            type="number"
            min="0.01"
            step="any"
            inputMode="decimal"
            defaultValue={defaults.quantity ?? 1}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-price`}>Price (R)</Label>
          <Input
            ref={price}
            id={`${idPrefix}-price`}
            name="price"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={defaults.price ?? ""}
            placeholder="each"
          />
        </div>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-comment`}>Comment (optional)</Label>
        <Input id={`${idPrefix}-comment`} name="comment" defaultValue={defaults.comment ?? ""} placeholder="e.g. Free-range, on special at Checkers" />
      </div>
    </>
  );
}
