import { describe, expect, it } from "vitest";
import { cleanNumber, parseReceipt, tidyName, type OcrLine } from "./parse";

const box = { x0: 0, y0: 0, x1: 10, y1: 10 };
const lines = (...rows: (string | [string, number])[]): OcrLine[] =>
  rows.map((r) => (typeof r === "string" ? { text: r, confidence: 93, bbox: box } : { text: r[0], confidence: r[1], bbox: box }));

// What the text recogniser actually returned for e2e/fixtures/receipt.jpg.
const checkers = lines(
  "CHECKERS",
  "HYPER BRACKENFELL",
  "TEL 021 000 0000",
  "VAT NO 4150100000",
  "25/09/2026 14:32 TILL 07",
  "CLOVER MILK 2L 32.99",
  "ALBANY BREAD 700G 18.50",
  "2 @ 14.99",
  "KOO BAKED BEANS 29.98",
  "FRESH CHICKEN FILLETS 109.99",
  "XTRA SAVINGS -10.00",
  "TASTIC RICE 2KG 45.99",
  "TOTAL 227.45",
  "CARD 227.45",
  "CHANGE 0.00",
  "THANK YOU FOR SHOPPING",
);

describe("parseReceipt", () => {
  it("reads a clean till slip end to end", () => {
    const r = parseReceipt(checkers);
    expect(r.store).toMatchObject({ value: "Checkers", sure: true });
    expect(r.date).toMatchObject({ value: "2026-09-25", sure: true });
    expect(r.total.value).toBe(227.45);
    expect(r.items.map((i) => [i.name, i.quantity, i.unitPrice, i.lineTotal])).toEqual([
      ["Clover Milk 2L", 1, 32.99, 32.99],
      ["Albany Bread 700g", 1, 18.5, 18.5],
      ["Koo Baked Beans", 2, 14.99, 29.98],
      ["Fresh Chicken Fillets", 1, 109.99, 109.99],
      ["Xtra Savings", 1, -10, -10],
      ["Tastic Rice 2kg", 1, 45.99, 45.99],
    ]);
    expect(r.items[4].discount).toBe(true);
    expect(r.itemsTotal).toBe(227.45);
    expect(r.issues).toEqual([]);
  });

  it("stops at the total, so payment lines never become items", () => {
    expect(parseReceipt(checkers).items.some((i) => /card|change/i.test(i.raw))).toBe(false);
  });

  it("handles a name on one line and '2 @ price  total' on the next", () => {
    const r = parseReceipt(
      lines("PICK N PAY", "2026/09/20", "SUNLIGHT LIQUID 750ML", "2 @ 24.99 49.98", "BANANAS LOOSE 18.40", "TOTAL 68.38"),
    );
    expect(r.store.value).toBe("Pick n Pay");
    expect(r.date.value).toBe("2026-09-20");
    expect(r.items.map((i) => [i.name, i.quantity, i.unitPrice, i.lineTotal])).toEqual([
      ["Sunlight Liquid 750ml", 2, 24.99, 49.98],
      ["Bananas Loose", 1, 18.4, 18.4],
    ]);
    expect(r.issues).toEqual([]);
  });

  it("attaches a quantity line to the item above when the numbers fit", () => {
    const r = parseReceipt(lines("SPAR", "01-09-2026", "EGGS LARGE 18S 59.98", "2 X 29.99", "TOTAL 59.98"));
    expect(r.items[0]).toMatchObject({ quantity: 2, unitPrice: 29.99, lineTotal: 59.98 });
  });

  it("asks about hard-to-read lines, a missing date and totals that don't add up", () => {
    const r = parseReceipt(lines("WOOLWORTHS", ["FRE5H PASTA 45.99", 51], "OLIVE OIL 1L 119.99", "TOTAL 175.98"));
    expect(r.items[0].issues[0]).toMatch(/hard to read/);
    expect(r.issues).toContain("What date was this receipt?");
    expect(r.issues.find((i) => i.startsWith("The items add up to 165.98"))).toBeTruthy();
  });

  it("keeps a line too blurry to price as an item to ask about", () => {
    // What the recogniser returned for a receipt with one smudged line.
    const r = parseReceipt(
      lines(
        "MAMA'S DELI",
        "12 MAIN ROAD, STELLENBOSCH",
        "SOURDOUGH LOAF 65.00",
        ['BRIE WEDGE 12% "me"', 58],
        "COFFEE BEANS 500G 179.00",
        "TOTAL 333.99",
      ),
    );
    expect(r.items.map((i) => [i.name, i.lineTotal])).toEqual([
      ["Sourdough Loaf", 65],
      ["Brie Wedge 12 Me", null],
      ["Coffee Beans 500g", 179],
    ]);
    expect(r.items[1].issues[0]).toMatch(/too blurry/);
    expect(r.items[1].lines).toEqual([3]);
  });

  it("ignores clear text lines without a price", () => {
    const r = parseReceipt(lines("SPAR", "25/09/2026", "WELCOME BACK", "MILK 2L 32.99", "TOTAL 32.99"));
    expect(r.items.map((i) => i.name)).toEqual(["Milk 2L"]);
  });

  it("guesses an unknown store from the top of the receipt but asks to confirm", () => {
    const r = parseReceipt(lines("MAMA'S DELI", "12 Main Road", "15/09/2026", "SOURDOUGH 65.00", "TOTAL 65.00"));
    expect(r.store).toMatchObject({ value: "Mama's Deli", sure: false });
    expect(r.issues).toContain('Is the store "Mama\'s Deli"?');
  });

  it("recognises stores you've added yourself", () => {
    const r = parseReceipt(lines("MAMA'S DELI", "15/09/2026", "SOURDOUGH 65.00", "TOTAL 65.00"), ["Mama's Deli"]);
    expect(r.store).toMatchObject({ value: "Mama's Deli", sure: true });
  });

  it("asks for the total when there isn't one", () => {
    expect(parseReceipt(lines("CLICKS", "15/09/2026", "PANADO 24S 39.99")).issues).toContain(
      "The total couldn't be found. What did it come to?",
    );
  });
});

describe("receipt text helpers", () => {
  it("fixes letters misread as digits in prices", () => {
    expect(cleanNumber("MILK 32.9O")).toBe("MILK 32.90");
    expect(cleanNumber("BREAD l8.5O")).toBe("BREAD l8.50");
    expect(cleanNumber("RICE 4S.99")).toBe("RICE 4S.99");
  });

  it("tidies product names", () => {
    expect(tidyName("CLOVER  MILK 2L")).toBe("Clover Milk 2L");
    expect(tidyName("TASTIC RICE 2KG 6001234567890")).toBe("Tastic Rice 2kg");
    expect(tidyName("SUNLIGHT LIQUID 750ML")).toBe("Sunlight Liquid 750ml");
  });
});
