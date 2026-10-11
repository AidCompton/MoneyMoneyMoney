// Shapes passed between the phone (which reads the photo), the server (which
// makes sense of the text) and the save action.

export type Box = { x0: number; y0: number; x1: number; y1: number };

/** What the phone read: text lines with where they sit on the display image. */
export type ReadLines = {
  lines: { text: string; confidence: number; bbox: Box }[];
  /** Size of the display image the boxes refer to. */
  width: number;
  height: number;
};

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
  store: { value: string; sure: boolean; crop: Box | null };
  date: { value: string; sure: boolean };
  total: number | null;
  items: ScannedItem[];
};

export type ReceiptDraft = {
  scope: "shared" | "personal";
  store: string;
  date: string;
  total: number;
  /** The display photo as a base64 JPEG, or null when typed in by hand. */
  image: string | null;
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
