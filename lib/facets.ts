// Cross-filtering: narrow a list by several dimensions at once (category,
// sub-category, store, person...), and for each dimension work out which
// values are still available given the *other* filters. Picking a store then
// shows only the categories and sub-categories you've actually bought there.

/** Filter value that matches rows with nothing set for that dimension. */
export const NONE = "none";

export type Dimension<T> = {
  value: (row: T) => string | null | undefined;
  label: (row: T) => string;
  color?: (row: T) => string | undefined;
};

export type FacetOption = {
  value: string;
  label: string;
  count: number;
  total: number;
  color?: string;
};

type Filters = Record<string, string | undefined>;

function matches<T>(row: T, dims: Record<string, Dimension<T>>, filters: Filters, skip?: string) {
  for (const [key, dim] of Object.entries(dims)) {
    if (key === skip) continue;
    const wanted = filters[key];
    if (!wanted) continue;
    if ((dim.value(row) ?? NONE) !== wanted) return false;
  }
  return true;
}

export function crossFilter<T>(
  rows: T[],
  dims: Record<string, Dimension<T>>,
  filters: Filters,
  amount: (row: T) => number,
) {
  const active: Filters = {};
  for (const key of Object.keys(dims)) {
    if (filters[key]) active[key] = filters[key];
  }

  const filtered = rows.filter((row) => matches(row, dims, active));

  const facets: Record<string, FacetOption[]> = {};
  for (const [key, dim] of Object.entries(dims)) {
    const options = new Map<string, FacetOption>();
    for (const row of rows) {
      if (!matches(row, dims, active, key)) continue;
      const raw = dim.value(row);
      const value = raw ?? NONE;
      const option = options.get(value) ?? {
        value,
        label: raw ? dim.label(row) : "None",
        count: 0,
        total: 0,
        color: raw ? dim.color?.(row) : undefined,
      };
      option.count += 1;
      option.total += amount(row);
      options.set(value, option);
    }
    facets[key] = [...options.values()].sort(
      (a, b) => b.total - a.total || a.label.localeCompare(b.label),
    );
  }

  return {
    filtered,
    facets,
    active,
    total: filtered.reduce((sum, row) => sum + amount(row), 0),
  };
}
