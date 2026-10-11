-- Lock the app's tables away from Supabase's Data API.
--
-- The app connects to Postgres directly, as the database owner, from the
-- server only. Supabase also creates the roles anon, authenticated and
-- service_role, which its REST/GraphQL API uses with the project's API keys.
-- None of them should ever reach this data, so they get no access to the app
-- schema, and row level security is switched on for every table with no
-- policies (owner connections are unaffected; any other role sees nothing).
-- On a plain Postgres without those roles the first block does nothing.
--
-- New tables added by later migrations need the same ENABLE ROW LEVEL SECURITY.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA app FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA app FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "app"."action_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."auth_throttle" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."budget_lines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."goal_contributions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."grocery_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."grocery_list_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."households" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."incomes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."labels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."meal_preps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."money_meetings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."receipt_aliases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."receipt_images" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."receipt_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."receipts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."savings_accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."savings_goals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."savings_transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."shared_contributions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."subcategories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."users" ENABLE ROW LEVEL SECURITY;
