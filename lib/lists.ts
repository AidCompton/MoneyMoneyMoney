// Pick-list names: what you type is kept for display, and a normalised key
// decides whether two entries are the same ("Pick n Pay" = "pick n pay ").

export function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function nameKey(value: string) {
  return cleanName(value).toLocaleLowerCase("en-ZA");
}

export const LIST_KINDS = {
  store: "Stores",
  income_source: "Income sources",
  savings_tag: "Savings sub-categories",
} as const;

export type LabelKind = keyof typeof LIST_KINDS;
