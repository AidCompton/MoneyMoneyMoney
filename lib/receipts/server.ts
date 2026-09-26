import "server-only";
import fs from "node:fs";
import path from "node:path";
import { and, desc, eq, isNull, count } from "drizzle-orm";
import { dataDir, db } from "@/db";
import { categories, expenses, labels, receiptAliases, subcategories } from "@/db/schema";
import { FOOD_CATEGORY } from "@/lib/categories";
import { nameKey } from "@/lib/lists";
import { ensureSharedCategories } from "@/lib/data/lists";
import type { Box, ScanResult } from "./types";
import { parseReceipt, tidyName } from "./parse";
import { readReceiptImage } from "./ocr";

// Photos: data/receipts/<receipt id>.jpg once saved, data/receipts/tmp while
// being reviewed (tidied up after a day).
export const receiptsDir = () => path.join(dataDir, "receipts");
const tmpDir = () => path.join(receiptsDir(), "tmp");
export const TOKEN = /^[0-9a-f-]{36}$/;

function clearOldTemp() {
  if (!fs.existsSync(tmpDir())) return;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(tmpDir())) {
    const full = path.join(tmpDir(), file);
    if (fs.statSync(full).mtimeMs < dayAgo) fs.rmSync(full, { force: true });
  }
}

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

/** Reads a photo and prepares everything the review screen needs. */
export async function scanReceipt(householdId: string, userId: string, photo: Buffer): Promise<ScanResult> {
  const read = await readReceiptImage(photo);

  const knownStores = db
    .select({ name: labels.name })
    .from(labels)
    .where(and(eq(labels.householdId, householdId), eq(labels.kind, "store")))
    .all()
    .map((l) => l.name);
  const parsed = parseReceipt(read.lines, knownStores);
  const storeName = parsed.store.value ?? "";

  // What each line was last time, per budget.
  const aliases = db.select().from(receiptAliases).where(eq(receiptAliases.householdId, householdId)).all();
  const cats = db.select().from(categories).where(eq(categories.householdId, householdId)).all();
  const subs = db.select().from(subcategories).where(eq(subcategories.householdId, householdId)).all();
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "";
  const subName = (id: string | null) => subs.find((s) => s.id === id)?.name ?? "";

  // Otherwise: whatever this store is usually filed under.
  ensureSharedCategories(householdId);
  const store = storeName
    ? db
        .select()
        .from(labels)
        .where(and(eq(labels.householdId, householdId), eq(labels.kind, "store"), eq(labels.key, nameKey(storeName))))
        .get()
    : undefined;
  const usual = (owner: string | null) => {
    if (!store) return null;
    return (
      db
        .select({ categoryId: expenses.categoryId, n: count() })
        .from(expenses)
        .where(
          and(
            eq(expenses.storeId, store.id),
            owner ? eq(expenses.ownerUserId, owner) : isNull(expenses.ownerUserId),
          ),
        )
        .groupBy(expenses.categoryId)
        .orderBy(desc(count()))
        .get()?.categoryId ?? null
    );
  };
  const sharedDefault =
    usual(null) ??
    cats.find((c) => c.scope === "shared" && c.key === nameKey(FOOD_CATEGORY))?.id ??
    null;
  const personalDefault = catName(usual(userId));

  fs.mkdirSync(tmpDir(), { recursive: true });
  clearOldTemp();
  const token = crypto.randomUUID();
  fs.writeFileSync(path.join(tmpDir(), `${token}.jpg`), read.image);

  return {
    token,
    image: { src: `data:image/jpeg;base64,${read.image.toString("base64")}`, width: read.width, height: read.height },
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

/** Moves a reviewed photo to its permanent home. Returns whether there was one. */
export function keepReceiptImage(token: string | null, receiptId: string) {
  if (!token || !TOKEN.test(token)) return false;
  const from = path.join(tmpDir(), `${token}.jpg`);
  if (!fs.existsSync(from)) return false;
  fs.renameSync(from, path.join(receiptsDir(), `${receiptId}.jpg`));
  return true;
}

export function removeReceiptImage(receiptId: string) {
  fs.rmSync(path.join(receiptsDir(), `${receiptId}.jpg`), { force: true });
}

export function receiptImagePath(receiptId: string) {
  return path.join(receiptsDir(), `${receiptId}.jpg`);
}

