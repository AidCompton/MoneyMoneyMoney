import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const households = sqliteTable("households", {
  id: id(),
  name: text("name").notNull(),
  joinCode: text("join_code").notNull().unique(),
  createdAt: createdAt(),
});

export const users = sqliteTable("users", {
  id: id(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const savingsGoals = sqliteTable("savings_goals", {
  id: id(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
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

export const monthlyBudgets = sqliteTable(
  "monthly_budgets",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    category: text("category").notNull().default("Groceries"),
    budgetedAmount: real("budgeted_amount").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("monthly_budgets_household_month_category").on(
      table.householdId,
      table.month,
      table.category,
    ),
  ],
);

export const expenses = sqliteTable("expenses", {
  id: id(),
  budgetId: text("budget_id")
    .notNull()
    .references(() => monthlyBudgets.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  createdAt: createdAt(),
});

export const moneyMeetings = sqliteTable("money_meetings", {
  id: id(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
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

export const householdsRelations = relations(households, ({ many }) => ({
  users: many(users),
  savingsGoals: many(savingsGoals),
  monthlyBudgets: many(monthlyBudgets),
  moneyMeetings: many(moneyMeetings),
}));

export const usersRelations = relations(users, ({ one }) => ({
  household: one(households, {
    fields: [users.householdId],
    references: [households.id],
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

export const monthlyBudgetsRelations = relations(monthlyBudgets, ({ one, many }) => ({
  household: one(households, {
    fields: [monthlyBudgets.householdId],
    references: [households.id],
  }),
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  budget: one(monthlyBudgets, {
    fields: [expenses.budgetId],
    references: [monthlyBudgets.id],
  }),
  user: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
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
