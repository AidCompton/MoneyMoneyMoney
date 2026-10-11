// Category colours and the eight shared categories.
//
// Every category (shared or personal) stores a colour slot when it's created
// and keeps it forever, so its colour never changes between months or charts.
// The shared categories take slots 0-7 in the order below.
//
// The palette order was checked for colour-blind separation between every
// pair of neighbouring slices, including last-to-first around the ring,
// against the app's dark glass surface. Reordering changes which colours
// touch, so re-check before changing it. When some slots are missing from a
// chart, neighbours that were never checked can end up side by side, which
// is why every chart also has a labelled table and gaps between slices.
export const PALETTE = [
  "#199e70", // green
  "#d95926", // orange
  "#9085e9", // violet
  "#d55181", // magenta
  "#c98500", // gold
  "#1f9bb0", // cyan
  "#e66767", // red
  "#3987e5", // blue
] as const;

/** Neutral for the folded "Other" slice. */
export const OTHER_COLOR = "#7f918a";

export const SHARED_CATEGORIES = [
  "Food & Toiletries",
  "Cats",
  "Gas",
  "Fun activity",
  "House",
  "Miscellaneous",
  "IOU",
  "Gifts",
] as const;

export const FOOD_CATEGORY = SHARED_CATEGORIES[0];

export function colorForIndex(index: number) {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

// Money-flow bars (where income went). Drawn from the same palette and
// checked in these left-to-right orders:
//   personal:  spent · shared · saved · left
//   household: shared · first person · second person · saved · left
export const FLOW = {
  spent: PALETTE[1], // orange
  shared: PALETTE[7], // blue
  partner: PALETTE[2], // violet
  saved: PALETTE[0], // green
  left: PALETTE[4], // gold
} as const;
