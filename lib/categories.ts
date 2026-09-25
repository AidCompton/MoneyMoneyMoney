// The household's spending categories, in the order they appear everywhere
// (forms, legend, and clockwise around the pie).
//
// Colours are assigned per category and never change, so a category keeps
// its colour even in months where some categories have no spending. The
// order was checked for colour-blind separation between every pair of
// neighbouring slices, including last-to-first around the ring, against the
// app's dark glass surface. Reordering the list changes which slices touch,
// so re-check before changing it.
export const CATEGORIES = [
  { name: "Food & Toiletries", color: "#199e70" },
  { name: "Cats", color: "#d95926" },
  { name: "Gas", color: "#9085e9" },
  { name: "Fun activity", color: "#d55181" },
  { name: "House", color: "#c98500" },
  { name: "Miscellaneous", color: "#1f9bb0" },
  { name: "IOU", color: "#e66767" },
  { name: "Gifts", color: "#3987e5" },
] as const;

export type CategoryName = (typeof CATEGORIES)[number]["name"];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name) as CategoryName[];

export function isCategory(value: string): value is CategoryName {
  return (CATEGORY_NAMES as string[]).includes(value);
}

export function categoryColor(name: string) {
  return CATEGORIES.find((c) => c.name === name)?.color ?? "#8a9a92";
}

/** Form field name for a category's planned amount, e.g. "plan-Food & Toiletries". */
export function planField(name: CategoryName) {
  return `plan-${name}`;
}
