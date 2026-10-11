import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { categories, expenses, labels, receiptAliases, subcategories } from "@/db/schema";
import { FOOD_CATEGORY } from "@/lib/categories";
import { nameKey } from "@/lib/lists";
import { ensureSharedCategories } from "@/lib/data/lists";
import type { Box, ReadLines, ScanResult } from "./types";
import { parseReceipt, tidyName, type OcrLine } from "./parse";

/** The key a receipt line is remembered by: its tidied name, without digits noise. */
export function aliasKey(raw: string) {
  return nameKey(tidyName(raw));
}

function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

const MAX_LINES = 400;
const MAX_SIDE = 10_000;
const finite = (n: unknown, max: number) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;

/**
 * Checks what the phone sent before trusting any of it: a sensible number of
 * short lines with boxes inside the image. Returns null if it doesn't look
 * like OCR output.
 */
export function cleanReadLines(input: unknown): (ReadLines & { lines: OcrLine[] }) | null {
  if (!input || typeof input !== "object") return null;
  const { lines, width, height } = input as Partial<ReadLines>;
  if (!finite(width, MAX_SIDE) || !finite(height, MAX_SIDE) || !Array.isArray(lines) || lines.length > MAX_LINES) {
    return null;
  }
  const clean: OcrLine[] = [];
  for (const line of lines) {
    if (!line || typeof line.text !== "string" || !finite(line.confidence, 100) || !line.bbox) return null;
    const { x0, y0, x1, y1 } = line.bbox;
    if (![x0, x1].every((v) => finite(v, width!)) || ![y0, y1].every((v) => finite(v, height!))) return null;
    clean.push({ text: line.text.slice(0, 300), confidence: line.confidence, bbox: { x0, y0, x1, y1 } });
  }
  return { lines: clean, width: width!, height: height! };
}

/** Makes sense of the text the phone read, and suggests what each line is. */
export async function prepareReceipt(householdId: string, userId: string, read: ReadLines & { lines: OcrLine[] }): Promise<ScanResult> {
  await ensureSharedCategories(householdId);

  const [storeRows, aliases, cats, subs] = await Promise.all([
    db
      .select({ name: labels.name })
      .from(labels)
      .where(and(eq(labels.householdId, householdId), eq(labels.kind, "store"))),
    db.select().from(receiptAliases).where(eq(receiptAliases.householdId, householdId)),
    db.select().from(categories).where(eq(categories.householdId, householdId)),
    db.select().from(subcategories).where(eq(subcategories.householdId, householdId)),
  ]);
  const parsed = parseReceipt(
    read.lines,
    storeRows.map((l) => l.name),
  );
  const storeName = parsed.store.value ?? "";
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "";
  const subName = (id: string | null) => subs.find((s) => s.id === id)?.name ?? "";

  // Otherwise: whatever this store is usually filed under.
  const [store] = storeName
    ? await db
        .select()
        .from(labels)
        .where(and(eq(labels.householdId, householdId), eq(labels.kind, "store"), eq(labels.key, nameKey(storeName))))
        .limit(1)
    : [];
  const usual = async (owner: string | null) => {
    if (!store) return null;
    const [row] = await db
      .select({ categoryId: expenses.categoryId, n: count() })
      .from(expenses)
      .where(
        and(
          eq(expenses.householdId, householdId),
          eq(expenses.storeId, store.id),
          owner ? eq(expenses.ownerUserId, owner) : isNull(expenses.ownerUserId),
        ),
      )
      .groupBy(expenses.categoryId)
      .orderBy(desc(count()))
      .limit(1);
    return row?.categoryId ?? null;
  };
  const [sharedUsual, personalUsual] = await Promise.all([usual(null), usual(userId)]);
  const sharedDefault =
    sharedUsual ?? cats.find((c) => c.scope === "shared" && c.key === nameKey(FOOD_CATEGORY))?.id ?? null;
  const personalDefault = catName(personalUsual);

  return {
    store: {
      value: storeName,
      sure: parsed.store.sure,
      crop: parsed.store.line !== null ? read.lines[parsed.store.line].bbox : null,
    },
    date: { value: parsed.date.value ?? "", sure: parsed.date.sure },
    total: parsed.total.value,
    items: parsed.items.map((item) => {
      const key = aliasKey(item.raw);
      const sharedAlias = aliases.find((a) => a.scope === "shared" && a.key === key);
      const personalAlias = aliases.find((a) => a.scope === "personal" && a.key === key);
      const remembered = sharedAlias ?? personalAlias;
      return {
        raw: item.raw,
        name: remembered?.name ?? item.name,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        discount: item.discount,
        issues: item.issues,
        crop: union(item.lines.map((i) => read.lines[i].bbox)),
        shared: {
          categoryId: sharedAlias?.categoryId ?? sharedDefault,
          subcategory: subName(sharedAlias?.subcategoryId ?? null),
        },
        personal: {
          category: catName(personalAlias?.categoryId ?? null) || personalDefault,
          subcategory: subName(personalAlias?.subcategoryId ?? null),
        },
        remembered: !!remembered,
      };
    }),
  };
}

const MAX_IMAGE_BYTES = 750 * 1024;

/**
 * Decodes the receipt photo the phone sent: it must be a JPEG of a sensible
 * size. Returns the bytes, or null if it isn't one.
 */
export function decodeReceiptImage(base64: unknown): Uint8Array | null {
  if (typeof base64 !== "string" || !base64 || base64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  // JPEG files start FF D8 FF.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  return bytes;
}
