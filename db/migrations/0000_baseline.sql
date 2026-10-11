CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."action_items" (
	"id" text PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"description" text NOT NULL,
	"assignee_user_id" text,
	"done" boolean DEFAULT false NOT NULL,
	"due_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."auth_throttle" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."budget_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"owner_user_id" text,
	"month" text NOT NULL,
	"category_id" text NOT NULL,
	"amount" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_lines_unique" UNIQUE NULLS NOT DISTINCT("household_id","owner_user_id","month","category_id")
);
--> statement-breakpoint
CREATE TABLE "app"."categories" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"scope" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"color_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"owner_user_id" text,
	"category_id" text NOT NULL,
	"subcategory_id" text,
	"store_id" text,
	"receipt_id" text,
	"user_id" text NOT NULL,
	"amount" double precision NOT NULL,
	"description" text NOT NULL,
	"date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."goal_contributions" (
	"id" text PRIMARY KEY NOT NULL,
	"goal_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount" double precision NOT NULL,
	"note" text,
	"date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."grocery_items" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"last_size" text,
	"last_price" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."grocery_list_items" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"month" text NOT NULL,
	"item_id" text NOT NULL,
	"meal_prep_id" text,
	"size" text,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"price" double precision,
	"comment" text,
	"bought" boolean DEFAULT false NOT NULL,
	"added_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."households" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"join_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "households_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "app"."incomes" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"user_id" text NOT NULL,
	"source_id" text,
	"amount" double precision NOT NULL,
	"date" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."labels" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."meal_preps" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"month" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"dinners" integer DEFAULT 1 NOT NULL,
	"cook_on" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."money_meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"date" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."receipt_aliases" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"category_id" text,
	"subcategory_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."receipt_images" (
	"receipt_id" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."receipt_items" (
	"id" text PRIMARY KEY NOT NULL,
	"receipt_id" text NOT NULL,
	"expense_id" text,
	"raw" text NOT NULL,
	"name" text NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"unit_price" double precision,
	"line_total" double precision NOT NULL,
	"category_id" text,
	"subcategory_id" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"owner_user_id" text,
	"store_id" text,
	"date" text NOT NULL,
	"total" double precision NOT NULL,
	"has_image" boolean DEFAULT false NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."savings_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"owner_user_id" text,
	"name" text NOT NULL,
	"institution" text,
	"target_amount" double precision,
	"opening_balance" double precision DEFAULT 0 NOT NULL,
	"opening_date" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."savings_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"target_amount" double precision NOT NULL,
	"target_date" text,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."savings_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"user_id" text NOT NULL,
	"tag_id" text,
	"amount" double precision NOT NULL,
	"date" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."shared_contributions" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount" double precision NOT NULL,
	"date" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."subcategories" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "app"."action_items" ADD CONSTRAINT "action_items_meeting_id_money_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "app"."money_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."action_items" ADD CONSTRAINT "action_items_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."budget_lines" ADD CONSTRAINT "budget_lines_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."budget_lines" ADD CONSTRAINT "budget_lines_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."budget_lines" ADD CONSTRAINT "budget_lines_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."categories" ADD CONSTRAINT "categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."expenses" ADD CONSTRAINT "expenses_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."expenses" ADD CONSTRAINT "expenses_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."expenses" ADD CONSTRAINT "expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."expenses" ADD CONSTRAINT "expenses_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "app"."subcategories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."expenses" ADD CONSTRAINT "expenses_store_id_labels_id_fk" FOREIGN KEY ("store_id") REFERENCES "app"."labels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."expenses" ADD CONSTRAINT "expenses_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "app"."receipts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_savings_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "app"."savings_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."goal_contributions" ADD CONSTRAINT "goal_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."grocery_items" ADD CONSTRAINT "grocery_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."grocery_list_items" ADD CONSTRAINT "grocery_list_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."grocery_list_items" ADD CONSTRAINT "grocery_list_items_item_id_grocery_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "app"."grocery_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."grocery_list_items" ADD CONSTRAINT "grocery_list_items_meal_prep_id_meal_preps_id_fk" FOREIGN KEY ("meal_prep_id") REFERENCES "app"."meal_preps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."grocery_list_items" ADD CONSTRAINT "grocery_list_items_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."incomes" ADD CONSTRAINT "incomes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."incomes" ADD CONSTRAINT "incomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."incomes" ADD CONSTRAINT "incomes_source_id_labels_id_fk" FOREIGN KEY ("source_id") REFERENCES "app"."labels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."labels" ADD CONSTRAINT "labels_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."meal_preps" ADD CONSTRAINT "meal_preps_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."money_meetings" ADD CONSTRAINT "money_meetings_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipt_aliases" ADD CONSTRAINT "receipt_aliases_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipt_aliases" ADD CONSTRAINT "receipt_aliases_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipt_aliases" ADD CONSTRAINT "receipt_aliases_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "app"."subcategories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipt_images" ADD CONSTRAINT "receipt_images_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "app"."receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipt_items" ADD CONSTRAINT "receipt_items_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "app"."receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipt_items" ADD CONSTRAINT "receipt_items_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "app"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipt_items" ADD CONSTRAINT "receipt_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipt_items" ADD CONSTRAINT "receipt_items_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "app"."subcategories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipts" ADD CONSTRAINT "receipts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipts" ADD CONSTRAINT "receipts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipts" ADD CONSTRAINT "receipts_store_id_labels_id_fk" FOREIGN KEY ("store_id") REFERENCES "app"."labels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."receipts" ADD CONSTRAINT "receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."savings_accounts" ADD CONSTRAINT "savings_accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."savings_accounts" ADD CONSTRAINT "savings_accounts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."savings_goals" ADD CONSTRAINT "savings_goals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."savings_transactions" ADD CONSTRAINT "savings_transactions_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "app"."savings_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."savings_transactions" ADD CONSTRAINT "savings_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."savings_transactions" ADD CONSTRAINT "savings_transactions_tag_id_labels_id_fk" FOREIGN KEY ("tag_id") REFERENCES "app"."labels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shared_contributions" ADD CONSTRAINT "shared_contributions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."shared_contributions" ADD CONSTRAINT "shared_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subcategories" ADD CONSTRAINT "subcategories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."users" ADD CONSTRAINT "users_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "app"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_meeting" ON "app"."action_items" USING btree ("meeting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_household_scope_key" ON "app"."categories" USING btree ("household_id","scope","key");--> statement-breakpoint
CREATE INDEX "expenses_household_date" ON "app"."expenses" USING btree ("household_id","date");--> statement-breakpoint
CREATE INDEX "goal_contributions_goal" ON "app"."goal_contributions" USING btree ("goal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_items_household_key" ON "app"."grocery_items" USING btree ("household_id","key");--> statement-breakpoint
CREATE INDEX "grocery_list_items_household_month" ON "app"."grocery_list_items" USING btree ("household_id","month");--> statement-breakpoint
CREATE INDEX "incomes_household_date" ON "app"."incomes" USING btree ("household_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_household_kind_key" ON "app"."labels" USING btree ("household_id","kind","key");--> statement-breakpoint
CREATE INDEX "meal_preps_household_month" ON "app"."meal_preps" USING btree ("household_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "receipt_aliases_household_scope_key" ON "app"."receipt_aliases" USING btree ("household_id","scope","key");--> statement-breakpoint
CREATE INDEX "receipt_items_receipt" ON "app"."receipt_items" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "receipts_household" ON "app"."receipts" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "savings_transactions_account_date" ON "app"."savings_transactions" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "shared_contributions_household_date" ON "app"."shared_contributions" USING btree ("household_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "subcategories_category_key" ON "app"."subcategories" USING btree ("category_id","key");--> statement-breakpoint
CREATE INDEX "users_household" ON "app"."users" USING btree ("household_id");