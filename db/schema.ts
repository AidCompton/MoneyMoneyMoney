import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Everything lives in its own "app" schema. Supabase's Data API only exposes
// the "public" schema, so none of these tables can be reached through it even
// if an API key leaked; the app talks to Postgres directly, on the server.
export const app = pgSchema("app");

/** Raw bytes (receipt photos). */
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

const householdId = () =>
  text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" });

export const households = app.table("households", {
  id: id(),
  name: text("name").notNull(),
  joinCode: text("join_code").notNull().unique(),
  createdAt: createdAt(),
});

export const users = app.table(
  "users",
  {
    id: id(),
    householdId: householdId(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    /**
     * Stored in the session cookie. Bumping it (changing your password, or
     * "sign out everywhere") makes every older cookie stop working.
     */
    sessionVersion: integer("session_version").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [index("users_household").on(t.householdId)],
);

// ---------------------------------------------------------------------------
// Pick lists
//
// Everything you type once and then choose from a dropdown lives here. Each
// entry has the name as you typed it plus a normalised `key` (trimmed,
// single-spaced, lower-case) so "Checkers" and "checkers " are the same entry.
// ---------------------------------------------------------------------------

/**
 * Spending categories. The eight shared ones are created with the household;
 * personal ones are typed in by either of you. `colorIndex` is fixed when a
 * category is created so it keeps its colour in every chart.
 */
export const categories = app.table(
  "categories",
  {
    id: id(),
    householdId: householdId(),
    scope: text("scope", { enum: ["shared", "personal"] }).notNull(),
    name: text("name").notNull(),
    key: text("key").notNull(),
    colorIndex: integer("color_index").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("categories_household_scope_key").on(t.householdId, t.scope, t.key)],
);

/** Sub-categories always belong to one category, e.g. Cats → Litter. */
export const subcategories = app.table(
  "subcategories",
  {
    id: id(),
    householdId: householdId(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("subcategories_category_key").on(t.categoryId, t.key)],
);

/** Flat pick lists: stores, income sources, and savings sub-categories. */
export const labels = app.table(
  "labels",
  {
    id: id(),
    householdId: householdId(),
    kind: text("kind", { enum: ["store", "income_source", "savings_tag"] }).notNull(),
    name: text("name").notNull(),
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("labels_household_kind_key").on(t.householdId, t.kind, t.key)],
);

// ---------------------------------------------------------------------------
// Budgets and spending. A row with no owner is shared; a row with an owner is
// that person's personal budget.
// ---------------------------------------------------------------------------

export const budgetLines = app.table(
  "budget_lines",
  {
    id: id(),
    householdId: householdId(),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // YYYY-MM
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    amount: doublePrecision("amount").notNull(),
    createdAt: createdAt(),
  },
  // One line per budget (shared = no owner), month and category. NULLS NOT
  // DISTINCT makes two shared lines (both owner NULL) count as duplicates.
  (t) => [unique("budget_lines_unique").on(t.householdId, t.ownerUserId, t.month, t.categoryId).nullsNotDistinct()],
);

export const expenses = app.table(
  "expenses",
  {
    id: id(),
    householdId: householdId(),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    // No cascade: a category that still has expenses can't be deleted.
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    subcategoryId: text("subcategory_id").references(() => subcategories.id, {
      onDelete: "set null",
    }),
    storeId: text("store_id").references(() => labels.id, { onDelete: "set null" }),
    /** Set when the expense came from a scanned receipt. */
    receiptId: text("receipt_id").references((): AnyPgColumn => receipts.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: doublePrecision("amount").notNull(),
    description: text("description").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    createdAt: createdAt(),
  },
  (t) => [index("expenses_household_date").on(t.householdId, t.date)],
);

export const incomes = app.table(
  "incomes",
  {
    id: id(),
    householdId: householdId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: text("source_id").references(() => labels.id, { onDelete: "set null" }),
    amount: doublePrecision("amount").notNull(),
    date: text("date").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("incomes_household_date").on(t.householdId, t.date)],
);

/** Money one of you moves from personal funds into the shared pot. */
export const sharedContributions = app.table(
  "shared_contributions",
  {
    id: id(),
    householdId: householdId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: doublePrecision("amount").notNull(),
    date: text("date").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("shared_contributions_household_date").on(t.householdId, t.date)],
);

// ---------------------------------------------------------------------------
// Savings
// ---------------------------------------------------------------------------

export const savingsGoals = app.table("savings_goals", {
  id: id(),
  householdId: householdId(),
  name: text("name").notNull(),
  targetAmount: doublePrecision("target_amount").notNull(),
  targetDate: text("target_date"),
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
});

export const goalContributions = app.table(
  "goal_contributions",
  {
    id: id(),
    goalId: text("goal_id")
      .notNull()
      .references(() => savingsGoals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: doublePrecision("amount").notNull(),
    note: text("note"),
    date: text("date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("goal_contributions_goal").on(t.goalId)],
);

/**
 * A savings account: personal to one of you, or joint (ownerUserId null,
 * shared by the household) like a joint account you both pay into. The
 * balance when it was added is stored as an opening balance (not a
 * deposit), so it doesn't count as "saved" in the month the account was set
 * up.
 */
export const savingsAccounts = app.table("savings_accounts", {
  id: id(),
  householdId: householdId(),
  ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  institution: text("institution"),
  targetAmount: doublePrecision("target_amount"),
  openingBalance: doublePrecision("opening_balance").notNull().default(0),
  openingDate: text("opening_date").notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
});

/** Deposits are positive, withdrawals negative. */
export const savingsTransactions = app.table(
  "savings_transactions",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => savingsAccounts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tagId: text("tag_id").references(() => labels.id, { onDelete: "set null" }),
    amount: doublePrecision("amount").notNull(),
    date: text("date").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("savings_transactions_account_date").on(t.accountId, t.date)],
);

// ---------------------------------------------------------------------------
// Groceries
// ---------------------------------------------------------------------------

/** Every grocery you've ever added, remembering the last size and price used. */
export const groceryItems = app.table(
  "grocery_items",
  {
    id: id(),
    householdId: householdId(),
    name: text("name").notNull(),
    key: text("key").notNull(),
    lastSize: text("last_size"),
    lastPrice: doublePrecision("last_price"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("grocery_items_household_key").on(t.householdId, t.key)],
);

export const mealPreps = app.table(
  "meal_preps",
  {
    id: id(),
    householdId: householdId(),
    month: text("month").notNull(),
    name: text("name").notNull(),
    key: text("key").notNull(),
    dinners: integer("dinners").notNull().default(1),
    cookOn: text("cook_on"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("meal_preps_household_month").on(t.householdId, t.month)],
);

/** One line on a month's grocery list: general when it has no meal prep. */
export const groceryListItems = app.table(
  "grocery_list_items",
  {
    id: id(),
    householdId: householdId(),
    month: text("month").notNull(),
    // No cascade: a grocery still on a list can't be deleted from the catalogue.
    itemId: text("item_id")
      .notNull()
      .references(() => groceryItems.id),
    mealPrepId: text("meal_prep_id").references(() => mealPreps.id, { onDelete: "cascade" }),
    size: text("size"),
    quantity: doublePrecision("quantity").notNull().default(1),
    price: doublePrecision("price"), // per unit
    comment: text("comment"),
    bought: boolean("bought").notNull().default(false),
    addedByUserId: text("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("grocery_list_items_household_month").on(t.householdId, t.month)],
);

// ---------------------------------------------------------------------------
// Scanned receipts
// ---------------------------------------------------------------------------

/**
 * A scanned till slip. Saving it creates one expense per category it covers;
 * its lines are kept as receipt items, and its photo in receipt_images.
 */
export const receipts = app.table(
  "receipts",
  {
    id: id(),
    householdId: householdId(),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    storeId: text("store_id").references(() => labels.id, { onDelete: "set null" }),
    date: text("date").notNull(),
    total: doublePrecision("total").notNull(),
    hasImage: boolean("has_image").notNull().default(false),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("receipts_household").on(t.householdId)],
);

/** The photo of a receipt (a JPEG, about 100-300 KB). */
export const receiptImages = app.table("receipt_images", {
  receiptId: text("receipt_id")
    .primaryKey()
    .references(() => receipts.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

export const receiptItems = app.table(
  "receipt_items",
  {
    id: id(),
    receiptId: text("receipt_id")
      .notNull()
      .references(() => receipts.id, { onDelete: "cascade" }),
    expenseId: text("expense_id").references(() => expenses.id, { onDelete: "set null" }),
    raw: text("raw").notNull(),
    name: text("name").notNull(),
    quantity: doublePrecision("quantity").notNull().default(1),
    unitPrice: doublePrecision("unit_price"),
    lineTotal: doublePrecision("line_total").notNull(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    subcategoryId: text("subcategory_id").references(() => subcategories.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("receipt_items_receipt").on(t.receiptId)],
);

/**
 * What a receipt line turned out to be, so the next receipt with the same
 * line fills itself in ("CLVR FRSH MLK 2L" → Milk, Food & Toiletries).
 */
export const receiptAliases = app.table(
  "receipt_aliases",
  {
    id: id(),
    householdId: householdId(),
    scope: text("scope", { enum: ["shared", "personal"] }).notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    subcategoryId: text("subcategory_id").references(() => subcategories.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("receipt_aliases_household_scope_key").on(t.householdId, t.scope, t.key)],
);

// ---------------------------------------------------------------------------
// Money Meetings
// ---------------------------------------------------------------------------

export const moneyMeetings = app.table("money_meetings", {
  id: id(),
  householdId: householdId(),
  date: text("date").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: createdAt(),
});

export const actionItems = app.table(
  "action_items",
  {
    id: id(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => moneyMeetings.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    assigneeUserId: text("assignee_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    done: boolean("done").notNull().default(false),
    dueDate: text("due_date"),
    createdAt: createdAt(),
  },
  (t) => [index("action_items_meeting").on(t.meetingId)],
);

// ---------------------------------------------------------------------------
// Sign-in protection
// ---------------------------------------------------------------------------

/**
 * Counts recent attempts (failed sign-ins, joins, sign-ups) per key such as
 * "login-email:aid@example.com" or "login-ip:203.0.113.7", so guessing
 * passwords or join codes gets locked out after a few tries.
 */
export const authThrottle = app.table("auth_throttle", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true, mode: "date" }).notNull(),
});

// ---------------------------------------------------------------------------
// Relations (for db.query ... with: {})
// ---------------------------------------------------------------------------

export const householdsRelations = relations(households, ({ many }) => ({
  users: many(users),
  savingsGoals: many(savingsGoals),
  moneyMeetings: many(moneyMeetings),
}));

export const usersRelations = relations(users, ({ one }) => ({
  household: one(households, {
    fields: [users.householdId],
    references: [households.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  subcategories: many(subcategories),
}));

export const subcategoriesRelations = relations(subcategories, ({ one }) => ({
  category: one(categories, {
    fields: [subcategories.categoryId],
    references: [categories.id],
  }),
}));

export const budgetLinesRelations = relations(budgetLines, ({ one }) => ({
  category: one(categories, {
    fields: [budgetLines.categoryId],
    references: [categories.id],
  }),
}));

export const receiptsRelations = relations(receipts, ({ one, many }) => ({
  store: one(labels, {
    fields: [receipts.storeId],
    references: [labels.id],
  }),
  user: one(users, {
    fields: [receipts.userId],
    references: [users.id],
  }),
  items: many(receiptItems),
}));

export const receiptItemsRelations = relations(receiptItems, ({ one }) => ({
  receipt: one(receipts, {
    fields: [receiptItems.receiptId],
    references: [receipts.id],
  }),
  category: one(categories, {
    fields: [receiptItems.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [receiptItems.subcategoryId],
    references: [subcategories.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  category: one(categories, {
    fields: [expenses.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [expenses.subcategoryId],
    references: [subcategories.id],
  }),
  store: one(labels, {
    fields: [expenses.storeId],
    references: [labels.id],
  }),
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
}));

export const incomesRelations = relations(incomes, ({ one }) => ({
  source: one(labels, {
    fields: [incomes.sourceId],
    references: [labels.id],
  }),
  user: one(users, {
    fields: [incomes.userId],
    references: [users.id],
  }),
}));

export const sharedContributionsRelations = relations(sharedContributions, ({ one }) => ({
  user: one(users, {
    fields: [sharedContributions.userId],
    references: [users.id],
  }),
}));

export const savingsGoalsRelations = relations(savingsGoals, ({ one, many }) => ({
  household: one(households, {
    fields: [savingsGoals.householdId],
    references: [households.id],
  }),
  contributions: many(goalContributions),
}));

export const goalContributionsRelations = relations(goalContributions, ({ one }) => ({
  goal: one(savingsGoals, {
    fields: [goalContributions.goalId],
    references: [savingsGoals.id],
  }),
  user: one(users, {
    fields: [goalContributions.userId],
    references: [users.id],
  }),
}));

export const savingsAccountsRelations = relations(savingsAccounts, ({ one, many }) => ({
  owner: one(users, {
    fields: [savingsAccounts.ownerUserId],
    references: [users.id],
  }),
  transactions: many(savingsTransactions),
}));

export const savingsTransactionsRelations = relations(savingsTransactions, ({ one }) => ({
  account: one(savingsAccounts, {
    fields: [savingsTransactions.accountId],
    references: [savingsAccounts.id],
  }),
  tag: one(labels, {
    fields: [savingsTransactions.tagId],
    references: [labels.id],
  }),
  user: one(users, {
    fields: [savingsTransactions.userId],
    references: [users.id],
  }),
}));

export const groceryListItemsRelations = relations(groceryListItems, ({ one }) => ({
  item: one(groceryItems, {
    fields: [groceryListItems.itemId],
    references: [groceryItems.id],
  }),
  mealPrep: one(mealPreps, {
    fields: [groceryListItems.mealPrepId],
    references: [mealPreps.id],
  }),
}));

export const mealPrepsRelations = relations(mealPreps, ({ many }) => ({
  items: many(groceryListItems),
}));

export const moneyMeetingsRelations = relations(moneyMeetings, ({ one, many }) => ({
  household: one(households, {
    fields: [moneyMeetings.householdId],
    references: [households.id],
  }),
  actionItems: many(actionItems),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  meeting: one(moneyMeetings, {
    fields: [actionItems.meetingId],
    references: [moneyMeetings.id],
  }),
  assignee: one(users, {
    fields: [actionItems.assigneeUserId],
    references: [users.id],
  }),
}));
