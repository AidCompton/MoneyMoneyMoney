"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { categories, expenses, groceryItems, groceryListItems, mealPreps } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { FOOD_CATEGORY } from "@/lib/categories";
import { isMonth } from "@/lib/dates";
import { isISODate, money, optionalStr, str } from "@/lib/form";
import { cleanName, nameKey } from "@/lib/lists";
import {
  ensureSharedCategories,
  findOrCreateGroceryItem,
  findOrCreateLabel,
  findOrCreateSubcategory,
} from "@/lib/data/lists";

export type ActionState = { error?: string; saved?: boolean };

function revalidateGroceries() {
  revalidatePath("/groceries");
  revalidatePath("/dashboard");
}

function readLine(fd: FormData) {
  const name = str(fd, "name");
  const quantity = money(fd, "quantity") ?? 1;
  const price = money(fd, "price");
  if (!cleanName(name)) return { error: "Name the grocery." };
  if (Number.isNaN(quantity) || quantity <= 0) return { error: "Quantity must be more than zero." };
  if (price !== null && (Number.isNaN(price) || price < 0)) return { error: "Price must be zero or more." };
  return { name, quantity, price, size: optionalStr(fd, "size"), comment: optionalStr(fd, "comment") };
}

/** Adds a grocery to the general list or to a meal prep. */
export async function addGroceryLine(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, household } = await requireSession();
  const month = str(fd, "month");
  const mealPrepId = str(fd, "mealPrepId") || null;
  if (!isMonth(month)) return { error: "Invalid month." };
  const line = readLine(fd);
  if ("error" in line) return { error: line.error };

  if (mealPrepId) {
    const prep = db.select().from(mealPreps).where(eq(mealPreps.id, mealPrepId)).get();
    if (!prep || prep.householdId !== household.id) return { error: "That meal prep could not be found." };
  }

  db.transaction((tx) => {
    const item = findOrCreateGroceryItem(household.id, line.name, tx)!;
    // Remember the latest size and price so next time they fill themselves in.
    tx.update(groceryItems)
      .set({ lastSize: line.size ?? item.lastSize, lastPrice: line.price ?? item.lastPrice })
      .where(eq(groceryItems.id, item.id))
      .run();
    tx.insert(groceryListItems)
      .values({
        householdId: household.id,
        month,
        itemId: item.id,
        mealPrepId,
        // Left blank? Use what it was last time.
        size: line.size ?? item.lastSize,
        quantity: line.quantity,
        price: line.price ?? item.lastPrice,
        comment: line.comment,
        addedByUserId: user.id,
      })
      .run();
  });

  revalidateGroceries();
  return { saved: true };
}

async function ownLine(lineId: string) {
  const { household } = await requireSession();
  const line = db.select().from(groceryListItems).where(eq(groceryListItems.id, lineId)).get();
  return line && line.householdId === household.id ? { line, householdId: household.id } : null;
}

export async function updateGroceryLine(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const owned = await ownLine(str(fd, "lineId"));
  if (!owned) return { error: "That grocery could not be found." };
  const line = readLine(fd);
  if ("error" in line) return { error: line.error };

  db.transaction((tx) => {
    const item = findOrCreateGroceryItem(owned.householdId, line.name, tx)!;
    tx.update(groceryItems)
      .set({ lastSize: line.size ?? item.lastSize, lastPrice: line.price ?? item.lastPrice })
      .where(eq(groceryItems.id, item.id))
      .run();
    tx.update(groceryListItems)
      .set({
        itemId: item.id,
        size: line.size,
        quantity: line.quantity,
        price: line.price,
        comment: line.comment,
      })
      .where(eq(groceryListItems.id, owned.line.id))
      .run();
  });

  revalidateGroceries();
  return { saved: true };
}

export async function toggleGroceryBought(lineId: string) {
  const owned = await ownLine(lineId);
  if (!owned) return;
  db.update(groceryListItems)
    .set({ bought: !owned.line.bought })
    .where(eq(groceryListItems.id, lineId))
    .run();
  revalidateGroceries();
}

export async function deleteGroceryLine(lineId: string) {
  const owned = await ownLine(lineId);
  if (!owned) return;
  db.delete(groceryListItems).where(eq(groceryListItems.id, lineId)).run();
  revalidateGroceries();
}

/**
 * Plans a meal prep. If you've made one with the same name before, its
 * ingredients are copied across so you only need to adjust them.
 */
export async function createMealPrep(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, household } = await requireSession();
  const month = str(fd, "month");
  const name = cleanName(str(fd, "name"));
  const dinners = Math.round(Number(str(fd, "dinners") || 1));
  const cookOn = str(fd, "cookOn") || null;
  if (!isMonth(month)) return { error: "Invalid month." };
  if (!name) return { error: "Name the meal prep." };
  if (!Number.isFinite(dinners) || dinners < 1) return { error: "It should cover at least one dinner." };
  if (cookOn && !isISODate(cookOn)) return { error: "Pick a valid cook date." };

  db.transaction((tx) => {
    const key = nameKey(name);
    const previous = tx
      .select()
      .from(mealPreps)
      .where(and(eq(mealPreps.householdId, household.id), eq(mealPreps.key, key)))
      .orderBy(desc(mealPreps.createdAt))
      .get();

    const prep = tx
      .insert(mealPreps)
      .values({
        householdId: household.id,
        month,
        name,
        key,
        dinners,
        cookOn,
        notes: str(fd, "notes") || previous?.notes || "",
      })
      .returning()
      .get();

    if (previous) {
      const ingredients = tx
        .select()
        .from(groceryListItems)
        .where(eq(groceryListItems.mealPrepId, previous.id))
        .all();
      for (const i of ingredients) {
        tx.insert(groceryListItems)
          .values({
            householdId: household.id,
            month,
            itemId: i.itemId,
            mealPrepId: prep.id,
            size: i.size,
            quantity: i.quantity,
            price: i.price,
            comment: i.comment,
            addedByUserId: user.id,
          })
          .run();
      }
    }
  });

  revalidateGroceries();
  return { saved: true };
}

export async function updateMealPrep(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { household } = await requireSession();
  const prep = db.select().from(mealPreps).where(eq(mealPreps.id, str(fd, "mealPrepId"))).get();
  if (!prep || prep.householdId !== household.id) return { error: "That meal prep could not be found." };
  const name = cleanName(str(fd, "name"));
  const dinners = Math.round(Number(str(fd, "dinners") || 1));
  const cookOn = str(fd, "cookOn") || null;
  if (!name) return { error: "Name the meal prep." };
  if (!Number.isFinite(dinners) || dinners < 1) return { error: "It should cover at least one dinner." };
  if (cookOn && !isISODate(cookOn)) return { error: "Pick a valid cook date." };

  db.update(mealPreps)
    .set({ name, key: nameKey(name), dinners, cookOn, notes: str(fd, "notes") })
    .where(eq(mealPreps.id, prep.id))
    .run();
  revalidateGroceries();
  return { saved: true };
}

export async function deleteMealPrep(mealPrepId: string) {
  const { household } = await requireSession();
  const prep = db.select().from(mealPreps).where(eq(mealPreps.id, mealPrepId)).get();
  if (!prep || prep.householdId !== household.id) return;
  // Its ingredients go with it (ON DELETE CASCADE).
  db.delete(mealPreps).where(eq(mealPreps.id, mealPrepId)).run();
  revalidateGroceries();
}

/** Copies another month's general list (not meal preps) into this month, unticked. */
export async function copyGeneralList(month: string, fromMonth: string) {
  const { user, household } = await requireSession();
  if (!isMonth(month) || !isMonth(fromMonth)) return;
  const lines = db
    .select()
    .from(groceryListItems)
    .where(
      and(
        eq(groceryListItems.householdId, household.id),
        eq(groceryListItems.month, fromMonth),
        isNull(groceryListItems.mealPrepId),
      ),
    )
    .all();
  if (!lines.length) return;
  db.insert(groceryListItems)
    .values(
      lines.map((l) => ({
        householdId: household.id,
        month,
        itemId: l.itemId,
        mealPrepId: null,
        size: l.size,
        quantity: l.quantity,
        price: l.price,
        comment: l.comment,
        addedByUserId: user.id,
      })),
    )
    .run();
  revalidateGroceries();
}

/**
 * Turns a shopping trip into a shared Food & Toiletries expense, so the
 * budget reflects what the shop actually cost.
 */
export async function logGroceryShop(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, household } = await requireSession();
  const amount = money(fd, "amount");
  const date = str(fd, "date");
  if (amount === null || Number.isNaN(amount) || amount <= 0) return { error: "Amount must be a positive number." };
  if (!isISODate(date)) return { error: "Pick the date of the shop." };

  ensureSharedCategories(household.id);
  db.transaction((tx) => {
    const food = tx
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.householdId, household.id),
          eq(categories.scope, "shared"),
          eq(categories.key, nameKey(FOOD_CATEGORY)),
        ),
      )
      .get()!;
    const store = findOrCreateLabel(household.id, "store", str(fd, "store"), tx);
    const subcategory = findOrCreateSubcategory(household.id, food.id, str(fd, "subcategory"), tx);
    tx.insert(expenses)
      .values({
        householdId: household.id,
        ownerUserId: null,
        categoryId: food.id,
        subcategoryId: subcategory?.id ?? null,
        storeId: store?.id ?? null,
        userId: user.id,
        amount,
        date,
        description: store ? `Grocery shop at ${store.name}` : "Grocery shop",
      })
      .run();
  });

  revalidatePath("/", "layout");
  return { saved: true };
}
