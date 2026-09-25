PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_savings_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`owner_user_id` text,
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
INSERT INTO `__new_savings_accounts`("id", "household_id", "owner_user_id", "name", "institution", "target_amount", "opening_balance", "opening_date", "archived", "created_at") SELECT "id", "household_id", "owner_user_id", "name", "institution", "target_amount", "opening_balance", "opening_date", "archived", "created_at" FROM `savings_accounts`;--> statement-breakpoint
DROP TABLE `savings_accounts`;--> statement-breakpoint
ALTER TABLE `__new_savings_accounts` RENAME TO `savings_accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;