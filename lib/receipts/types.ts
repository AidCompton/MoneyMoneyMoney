// Shapes passed between the scan endpoint, the review screen and the save action.

export type Box = { x0: number; y0: number; x1: number; y1: number };

export type ScannedItem = {
  raw: string;
  name: string;
  quantity: number;
  lineTotal: number | null;
  discount: boolean;
  issues: string[];
  /** The part of the photo this line came from (display-image pixels). */
  crop: Box | null;
  /** Suggestions, remembered from earlier receipts where possible. */
  shared: { categoryId: string | null; subcategory: string };
  personal: { category: string; subcategory: string };
  remembered: boolean;
};

export type ScanResult = {
  token: string;
  image: { src: string; width: number; height: number };
  store: { value: string; sure: boolean; crop: Box | null };
  date: { value: string; sure: boolean };
  total: number | null;
  items: ScannedItem[];
};

export type ReceiptDraft = {
  token: string | null;
  scope: "shared" | "personal";
  store: string;
  date: string;
  total: number;
  items: {
    raw: string;
    name: string;
    quantity: number;
    lineTotal: number;
    /** Shared: a category id. Personal: a category name. */
    category: string;
    subcategory: string;
  }[];
};
