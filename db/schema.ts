import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

const householdId = () =>
  text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" });

export const households = sqliteTable("households", {
  id: id(),
  name: text("name").notNull(),
  joinCode: text("join_code").notNull().unique(),
  createdAt: createdAt(),
});

export const users = sqliteTable("users", {
  id: id(),
  householdId: householdId(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

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
export const categories = sqliteTable(
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
export const subcategories = sqliteTable(
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
export const labels = sqliteTable(
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

export const budgetLines = sqliteTable(
  "budget_lines",
  {
    id: id(),
    householdId: householdId(),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // YYYY-MM
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    createdAt: createdAt(),
  },
  // Two partial indexes because SQLite treats every NULL owner as distinct,
  // so a single index could not stop duplicate shared lines.
  (t) => [
    uniqueIndex("budget_lines_shared_unique")
      .on(t.householdId, t.month, t.categoryId)
      .where(sql`owner_user_id is null`),
    uniqueIndex("budget_lines_personal_unique")
      .on(t.ownerUserId, t.month, t.categoryId)
      .where(sql`owner_user_id is not null`),
  ],
);

export const expenses = sqliteTable(
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
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    description: text("description").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    createdAt: createdAt(),
  },
  (t) => [index("expenses_household_date").on(t.householdId, t.date)],
);

export const incomes = sqliteTable(
  "incomes",
  {
    id: id(),
    householdId: householdId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: text("source_id").references(() => labels.id, { onDelete: "set null" }),
    amount: real("amount").notNull(),
    date: text("date").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("incomes_household_date").on(t.householdId, t.date)],
);

/** Money one of you moves from personal funds into the shared pot. */
export const sharedContributions = sqliteTable(
  "shared_contributions",
  {
    id: id(),
    householdId: householdId(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    date: text("date").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("shared_contributions_household_date").on(t.householdId, t.date)],
);

// ---------------------------------------------------------------------------
// Savings
// ---------------------------------------------------------------------------

export const savingsGoals = sqliteTable("savings_goals", {
  id: id(),
  householdId: householdId(),
  name: text("name").notNull(),
  targetAmount: real("target_amount").notNull(),
  targetDate: text("target_date"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const goalContributions = sqliteTable("goal_contributions", {
  id: id(),
  goalId: text("goal_id")
    .notNull()
    .references(() => savingsGoals.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  note: text("note"),
  date: text("date").notNull(),
  createdAt: createdAt(),
});

/**
 * A personal savings account. The balance when it was added is stored as an
 * opening balance (not a deposit), so it doesn't count as "saved" in the
 * month the account was set up.
 */
export const savingsAccounts = sqliteTable("savings_accounts", {
  id: id(),
  householdId: householdId(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  institution: text("institution"),
  targetAmount: real("target_amount"),
  openingBalance: real("opening_balance").notNull().default(0),
  openingDate: text("opening_date").notNull(),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

/** Deposits are positive, withdrawals negative. */
export const savingsTransactions = sqliteTable(
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
    amount: real("amount").notNull(),
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
export const groceryItems = sqliteTable(
  "grocery_items",
  {
    id: id(),
    householdId: householdId(),
    name: text("name").notNull(),
    key: text("key").notNull(),
    lastSize: text("last_size"),
    lastPrice: real("last_price"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("grocery_items_household_key").on(t.householdId, t.key)],
);

export const mealPreps = sqliteTable(
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
export const groceryListItems = sqliteTable(
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
    quantity: real("quantity").notNull().default(1),
    price: real("price"), // per unit
    comment: text("comment"),
    bought: integer("bought", { mode: "boolean" }).notNull().default(false),
    addedByUserId: text("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("grocery_list_items_household_month").on(t.householdId, t.month)],
);

// ---------------------------------------------------------------------------
// Money Meetings
// ---------------------------------------------------------------------------

export const moneyMeetings = sqliteTable("money_meetings", {
  id: id(),
  householdId: householdId(),
  date: text("date").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: createdAt(),
});

export const actionItems = sqliteTable("action_items", {
  id: id(),
  meetingId: text("meeting_id")
    .notNull()
    .references(() => moneyMeetings.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  assigneeUserId: text("assignee_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  dueDate: text("due_date"),
  createdAt: createdAt(),
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
