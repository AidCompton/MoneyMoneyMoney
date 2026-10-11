-- The monthly budget moved from a single "Groceries" line to eight spending
-- categories. Existing grocery budgets and their expenses become
-- "Food & Toiletries". Data-only: no table is rebuilt, because rebuilding
-- monthly_budgets would cascade-delete its expenses inside the migration
-- transaction.
UPDATE `monthly_budgets` SET `category` = 'Food & Toiletries' WHERE `category` = 'Groceries';
