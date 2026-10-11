CREATE TABLE `receipt_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`category_id` text,
	`subcategory_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipt_aliases_household_scope_key` ON `receipt_aliases` (`household_id`,`scope`,`key`);--> statement-breakpoint
CREATE TABLE `receipt_items` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`expense_id` text,
	`raw` text NOT NULL,
	`name` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price` real,
	`line_total` real NOT NULL,
	`category_id` text,
	`subcategory_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`owner_user_id` text,
	`store_id` text,
	`date` text NOT NULL,
	`total` real NOT NULL,
	`has_image` integer DEFAULT false NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `receipt_id` text REFERENCES receipts(id) ON DELETE set null;