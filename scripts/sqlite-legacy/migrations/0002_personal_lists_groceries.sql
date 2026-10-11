-- Budgets gain personal (owned) lines, expenses gain categories as real
-- records plus sub-categories and stores, and new tables arrive for pick
-- lists, income, contributions to the shared pot, savings accounts and the
-- grocery list.
--
-- monthly_budgets and expenses are rebuilt by copying into new tables.
-- The old expenses table is dropped before monthly_budgets, because dropping
-- monthly_budgets while expenses still referenced it would cascade-delete
-- every expense (foreign keys can't be switched off inside the migration's
-- transaction).
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`scope` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`color_index` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_household_scope_key` ON `categories` (`household_id`,`scope`,`key`);
--> statement-breakpoint
-- The eight shared categories, for every existing household.
INSERT INTO `categories` (`id`, `household_id`, `scope`, `name`, `key`, `color_index`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))), h.`id`, 'shared', c.column1, lower(c.column1), c.column2
FROM `households` h, (VALUES ('Food & Toiletries', 0), ('Cats', 1), ('Gas', 2), ('Fun activity', 3), ('House', 4), ('Miscellaneous', 5), ('IOU', 6), ('Gifts', 7)) c;
--> statement-breakpoint
CREATE TABLE `subcategories` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subcategories_category_key` ON `subcategories` (`category_id`,`key`);
--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labels_household_kind_key` ON `labels` (`household_id`,`kind`,`key`);
--> statement-breakpoint
CREATE TABLE `budget_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`owner_user_id` text,
	`month` text NOT NULL,
	`category_id` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_lines_shared_unique` ON `budget_lines` (`household_id`,`month`,`category_id`) WHERE owner_user_id is null;
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_lines_personal_unique` ON `budget_lines` (`owner_user_id`,`month`,`category_id`) WHERE owner_user_id is not null;
--> statement-breakpoint
-- Existing plans become shared budget lines. Zero-amount rows only existed to
-- hold expenses, which now carry their own category, so they're dropped.
INSERT INTO `budget_lines` (`id`, `household_id`, `owner_user_id`, `month`, `category_id`, `amount`, `created_at`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))), mb.`household_id`, NULL, mb.`month`, c.`id`, sum(mb.`budgeted_amount`), min(mb.`created_at`)
FROM `monthly_budgets` mb
JOIN `categories` c ON c.`household_id` = mb.`household_id` AND c.`scope` = 'shared' AND c.`name` = CASE WHEN mb.category IN ('Food & Toiletries', 'Cats', 'Gas', 'Fun activity', 'House', 'Miscellaneous', 'IOU', 'Gifts') THEN mb.category ELSE 'Miscellaneous' END
GROUP BY mb.`household_id`, mb.`month`, c.`id`
HAVING sum(mb.`budgeted_amount`) > 0;
--> statement-breakpoint
CREATE TABLE `__new_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`owner_user_id` text,
	`category_id` text NOT NULL,
	`subcategory_id` text,
	`store_id` text,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`date` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`store_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_expenses` (`id`, `household_id`, `owner_user_id`, `category_id`, `subcategory_id`, `store_id`, `user_id`, `amount`, `description`, `date`, `created_at`)
SELECT e.`id`, mb.`household_id`, NULL, c.`id`, NULL, NULL, e.`user_id`, e.`amount`, e.`description`, e.`date`, e.`created_at`
FROM `expenses` e
JOIN `monthly_budgets` mb ON mb.`id` = e.`budget_id`
JOIN `categories` c ON c.`household_id` = mb.`household_id` AND c.`scope` = 'shared' AND c.`name` = CASE WHEN mb.category IN ('Food & Toiletries', 'Cats', 'Gas', 'Fun activity', 'House', 'Miscellaneous', 'IOU', 'Gifts') THEN mb.category ELSE 'Miscellaneous' END;
--> statement-breakpoint
DROP TABLE `expenses`;
--> statement-breakpoint
DROP TABLE `monthly_budgets`;
--> statement-breakpoint
ALTER TABLE `__new_expenses` RENAME TO `expenses`;
--> statement-breakpoint
CREATE INDEX `expenses_household_date` ON `expenses` (`household_id`,`date`);
--> statement-breakpoint
CREATE TABLE `incomes` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source_id` text,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `incomes_household_date` ON `incomes` (`household_id`,`date`);
--> statement-breakpoint
CREATE TABLE `shared_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shared_contributions_household_date` ON `shared_contributions` (`household_id`,`date`);
--> statement-breakpoint
CREATE TABLE `savings_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`institution` text,
	`target_amount` real,
	`opening_balance` real DEFAULT 0 NOT NULL,
	`opening_date` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `savings_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`tag_id` text,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `savings_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `savings_transactions_account_date` ON `savings_transactions` (`account_id`,`date`);
--> statement-breakpoint
CREATE TABLE `grocery_items` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`last_size` text,
	`last_price` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grocery_items_household_key` ON `grocery_items` (`household_id`,`key`);
--> statement-breakpoint
CREATE TABLE `meal_preps` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`month` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`dinners` integer DEFAULT 1 NOT NULL,
	`cook_on` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_preps_household_month` ON `meal_preps` (`household_id`,`month`);
--> statement-breakpoint
CREATE TABLE `grocery_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`month` text NOT NULL,
	`item_id` text NOT NULL,
	`meal_prep_id` text,
	`size` text,
	`quantity` real DEFAULT 1 NOT NULL,
	`price` real,
	`comment` text,
	`bought` integer DEFAULT false NOT NULL,
	`added_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `grocery_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`meal_prep_id`) REFERENCES `meal_preps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `grocery_list_items_household_month` ON `grocery_list_items` (`household_id`,`month`);
