// Turns the text lines read from a receipt photo into a store, a date, line
// items and a total, and notes everything it isn't sure about so the review
// screen can ask. Pure: no I/O, so it's unit-tested directly.

import { nameKey } from "@/lib/lists";

export type OcrLine = {
  text: string;
  /** 0-100, from the text recogniser. */
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type ParsedItem = {
  raw: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  discount: boolean;
  /** Which OCR lines it came from, for showing that part of the photo. */
  lines: number[];
  issues: string[];
};

export type ParsedReceipt = {
  store: { value: string | null; sure: boolean; line: number | null };
  date: { value: string | null; sure: boolean; line: number | null };
  total: { value: number | null; line: number | null };
  items: ParsedItem[];
  itemsTotal: number;
  issues: string[];
};

/** Big South African chains, so the store is recognised on a first scan. */
export const KNOWN_STORES = [
  "Checkers",
  "Checkers Hyper",
  "Pick n Pay",
  "Woolworths",
  "Spar",
  "Superspar",
  "Kwikspar",
  "Shoprite",
  "Usave",
  "Food Lover's Market",
  "Makro",
  "Game",
  "Dis-Chem",
  "Clicks",
  "Boxer",
  "OK Foods",
  "Pep",
  "Ackermans",
  "Mr Price",
  "Builders",
  "Engen",
  "Shell",
  "BP",
  "Sasol",
  "Caltex",
  "Total",
  "Petshop Science",
  "Absolute Pets",
  "Montana Pet",
  "Takealot",
];

const UNCLEAR = 72; // below this line confidence, ask
const AMOUNT = /(-?)\s*R?\s*(\d{1,6})[.,](\d{2})\s*[A-Z*#]{0,2}$/i;
const QTY = /^(\d{1,3})\s*[@xX*]\s*R?\s*(\d{1,6}[.,]\d{2})(?:\s+(-?\d{1,6}[.,]\d{2}))?\s*[A-Z*#]{0,2}$/;
const TOTAL = /\b(total|amount due|balance due|to pay|totaal)\b/i;
const SUBTOTAL = /\bsub\s*-?\s*total\b/i;
const NOT_ITEMS =
  /\b(vat|tax|change|cash|card|tender(ed)?|rounding|paid|payment|visa|master\s*card|debit|credit|points?|balance|auth|approval|ref(erence)?|cashier|till|tel|slip|invoice|receipt|thank you|items? sold|qty sold)\b/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Common OCR slips in numbers: O→0, l/I→1, S→5, B→8, and comma decimals. */
export function cleanNumber(text: string) {
  return text
    .replace(/(?<=\d)[oO](?=\d|[.,])|(?<=[.,]\d?)[oO]/g, "0")
    .replace(/(?<=\d)[lI](?=\d)|(?<=[.,]\d?)[lI]/g, "1")
    .replace(/(?<=\d)S(?=\d)/g, "5");
}

function money(whole: string, cents: string, negative: boolean) {
  const value = Number(`${whole}.${cents}`);
  return negative ? -value : value;
}

function toAmount(text: string) {
  const m = cleanNumber(text).match(/(-?)\s*(\d{1,6})[.,](\d{2})/);
  return m ? money(m[2], m[3], m[1] === "-") : null;
}

/** "CLOVER MILK 2L" → "Clover Milk 2L"; drops product codes and stray symbols. */
export function tidyName(raw: string) {
  return raw
    .replace(/\b\d{6,}\b/g, "")
    .replace(/[|_*#~"“”«»%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b(\d+(?:[.,]\d+)?)(kg|g|ml|l|lt|s)\b/gi, (_, n, u) => `${n}${u === "l" || u === "lt" ? "L" : u}`)
    .replace(/\b([a-z])([a-z']*)/g, (_, a, rest) => a.toUpperCase() + rest)
    .replace(/\b(\d+(?:[.,]\d+)?)(Kg|G|Ml|S)\b/g, (_, n, u) => `${n}${u.toLowerCase()}`);
}

function parseDate(text: string): string | null {
  const iso = (y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  let m = text.match(/\b(20\d{2})[/.-](\d{1,2})[/.-](\d{1,2})\b/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  // South African receipts put the day first.
  m = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = text.match(/\b(\d{1,2})\s*([a-z]{3})[a-z]*\s*(\d{2,4})\b/i);
  if (m && MONTHS.includes(m[2].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  return null;
}

function findStore(header: { text: string; index: number }[], known: string[]) {
  // Longest names first, so "Checkers Hyper" wins over "Checkers".
  const candidates = [...known].sort((a, b) => b.length - a.length);
  for (const line of header) {
    const key = nameKey(line.text).replace(/[^a-z0-9' ]/g, " ");
    for (const store of candidates) {
      const storeKey = nameKey(store).replace(/[^a-z0-9' ]/g, " ");
      if (new RegExp(`(^|\\s)${storeKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(key)) {
        return { value: store, sure: true, line: line.index };
      }
    }
  }
  // Otherwise guess the first line that looks like a name, and ask.
  const guess = header.find((l) => /[a-z]{3,}/i.test(l.text) && !NOT_ITEMS.test(l.text) && !/\d{4,}/.test(l.text));
  return guess ? { value: tidyName(guess.text), sure: false, line: guess.index } : { value: null, sure: false, line: null };
}

export function parseReceipt(lines: OcrLine[], knownStores: string[] = []): ParsedReceipt {
  const issues: string[] = [];
  const items: ParsedItem[] = [];
  const text = lines.map((l) => l.text.replace(/\s+/g, " ").trim());

  let total: ParsedReceipt["total"] = { value: null, line: null };
  let date: ParsedReceipt["date"] = { value: null, sure: false, line: null };
  let firstItemLine: number | null = null;
  let pendingName: { raw: string; line: number } | null = null;
  let pendingQty: { quantity: number; unitPrice: number; line: number } | null = null;

  // A name line that never got a price. If it was hard to read, its price was
  // probably there but unreadable, so keep it as an item and ask.
  const flushPending = () => {
    if (pendingName && (lines[pendingName.line]?.confidence ?? 100) < UNCLEAR) {
      items.push(makeItem(pendingName.raw, 1, null, null, [pendingName.line], lines));
    }
    pendingName = null;
  };

  for (let i = 0; i < text.length; i++) {
    const line = text[i];
    if (!line) continue;

    if (!date.value) {
      const found = parseDate(line);
      if (found) date = { value: found, sure: true, line: i };
    }

    // Everything after the total is payment details.
    if (total.value !== null) break;

    const cleaned = cleanNumber(line);
    if (TOTAL.test(line) && !SUBTOTAL.test(line)) {
      const amount = cleaned.match(AMOUNT);
      if (amount) {
        flushPending();
        total = { value: money(amount[2], amount[3], false), line: i };
        continue;
      }
    }
    if (SUBTOTAL.test(line)) continue;

    const qty = cleaned.match(QTY);
    if (qty) {
      const quantity = Number(qty[1]);
      const unitPrice = toAmount(qty[2])!;
      const lineTotal = qty[3] ? toAmount(qty[3]) : null;
      if (lineTotal !== null && pendingName) {
        // "NAME" then "2 @ 14.99   29.98"
        items.push(makeItem(pendingName.raw, quantity, unitPrice, lineTotal, [pendingName.line, i], lines));
        pendingName = null;
      } else {
        // A quantity line without its own total belongs to a neighbour:
        // the item before it if the numbers fit, otherwise the next one.
        const previous = items[items.length - 1];
        if (previous && previous.lineTotal !== null && Math.abs(previous.lineTotal - quantity * unitPrice) < 0.015 && previous.quantity === 1) {
          previous.quantity = quantity;
          previous.unitPrice = unitPrice;
          previous.lines.push(i);
        } else {
          pendingQty = { quantity, unitPrice, line: i };
        }
      }
      firstItemLine ??= i;
      continue;
    }

    const amount = cleaned.match(AMOUNT);
    if (!amount) {
      // A name on its own line; its price may be on the next line.
      // Only once past the header (an item or the date has been seen).
      const pastHeader = firstItemLine !== null || (date.line !== null && i > date.line);
      if (pastHeader && /[a-z]{2,}/i.test(line) && !NOT_ITEMS.test(line)) {
        flushPending();
        pendingName = { raw: line, line: i };
      }
      continue;
    }
    if (NOT_ITEMS.test(line)) continue;

    const value = money(amount[2], amount[3], amount[1] === "-" || /-\s*$/.test(line.slice(0, amount.index)));
    const raw = line.slice(0, amount.index).replace(/-\s*$/, "").trim() || pendingName?.raw || "";
    if (!/[a-z]{2,}/i.test(raw)) continue; // a bare number, not an item
    firstItemLine ??= i;

    const ownName = !(pendingName && raw === pendingName.raw);
    const sourceLines = ownName ? [i] : [pendingName!.line, i];
    if (ownName) flushPending();
    let quantity = 1;
    let unitPrice: number | null = value;
    if (pendingQty && Math.abs(pendingQty.quantity * pendingQty.unitPrice - value) < 0.015) {
      quantity = pendingQty.quantity;
      unitPrice = pendingQty.unitPrice;
      sourceLines.unshift(pendingQty.line);
    }
    pendingQty = null;
    pendingName = null;
    items.push(makeItem(raw, quantity, unitPrice, value, sourceLines, lines));
  }

  flushPending();

  const header = text
    .map((t, index) => ({ text: t, index }))
    .slice(0, firstItemLine ?? Math.min(text.length, 6))
    .filter((l) => l.text);
  const store = findStore(header, [...knownStores, ...KNOWN_STORES]);

  const itemsTotal = round(items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0));

  if (!store.value) issues.push("Which store was this?");
  else if (!store.sure) issues.push(`Is the store "${store.value}"?`);
  if (!date.value) issues.push("What date was this receipt?");
  if (items.length === 0) issues.push("No items could be read. Add them below, or try a clearer photo.");
  if (total.value === null) issues.push("The total couldn't be found. What did it come to?");
  else if (items.length && Math.abs(total.value - itemsTotal) >= 0.01) {
    issues.push(`The items add up to ${itemsTotal.toFixed(2)} but the total says ${total.value.toFixed(2)}.`);
  }

  return { store, date, total, items, itemsTotal, issues };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function makeItem(
  raw: string,
  quantity: number,
  unitPrice: number | null,
  lineTotal: number | null,
  sourceLines: number[],
  lines: OcrLine[],
): ParsedItem {
  const issues: string[] = [];
  const confidence = Math.min(...sourceLines.map((i) => lines[i]?.confidence ?? 100));
  if (lineTotal === null) issues.push("This line was too blurry to read. What was it, and what did it cost?");
  else if (confidence < UNCLEAR) issues.push("This line was hard to read. Is the name and price right?");
  if (quantity > 1 && unitPrice !== null && lineTotal !== null && Math.abs(quantity * unitPrice - lineTotal) >= 0.015) {
    issues.push(`${quantity} × ${unitPrice.toFixed(2)} doesn't match ${lineTotal.toFixed(2)}.`);
  }
  const name = tidyName(raw);
  if (name.length < 3) issues.push("What was this item?");
  return {
    raw,
    name,
    quantity,
    unitPrice,
    lineTotal,
    discount: (lineTotal ?? 0) < 0,
    lines: sourceLines,
    issues,
  };
}
