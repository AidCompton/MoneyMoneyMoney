import Link from "next/link";
import { requireSession } from "@/lib/auth";
import {
  currentMonth,
  getCategoryOptions,
  getGroceryItemOptions,
  getLabelOptions,
  getSubcategoryOptions,
} from "@/lib/data";
import { Card } from "@/components/ui/Card";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { ExpenseForm } from "@/components/budget/ExpenseForm";
import { ReceiptScanner } from "@/components/receipts/ReceiptScanner";

type Search = { for?: string };

/**
 * The fastest way in: scan a receipt or type an expense. Made for opening
 * straight from a phone shortcut (see the README for the iPhone Back Tap setup).
 */
export default async function QuickAddPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { user, household } = await requireSession();
  const scope = (await searchParams).for === "personal" ? "personal" : "shared";
  const month = currentMonth();
  const shared = getCategoryOptions(household.id, "shared");
  const personal = getCategoryOptions(household.id, "personal");
  const stores = getLabelOptions(household.id, "store");
  const subcategories = {
    shared: getSubcategoryOptions(household.id, "shared"),
    personal: getSubcategoryOptions(household.id, "personal"),
  };

  const tab = (value: "shared" | "personal", label: string) => (
    <Link
      href={value === "shared" ? "/add" : "/add?for=personal"}
      aria-current={scope === value ? "page" : undefined}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        scope === value ? (value === "shared" ? "bg-gold/15 text-gold" : "bg-mint/15 text-mint") : "text-ivory/60 hover:text-ivory"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Quick add" title="Spent something?" accent="Log it." tone={scope === "personal" ? "mint" : "gold"}>
        <div className="glass inline-flex rounded-full p-1">
          {tab("shared", "Shared")}
          {tab("personal", "Personal")}
        </div>
      </PageHeader>

      <Card>
        <SectionTitle>Scan a receipt</SectionTitle>
        <ReceiptScanner
          key={scope}
          defaultScope={scope}
          userId={user.id}
          sharedCategories={shared}
          personalCategories={personal}
          subcategories={subcategories}
          stores={stores}
          groceryNames={getGroceryItemOptions(household.id).map((g) => g.name)}
        />
      </Card>

      <Card>
        <SectionTitle>Or add it by hand</SectionTitle>
        <ExpenseForm
          key={scope}
          scope={scope}
          month={month}
          categories={scope === "shared" ? shared : personal}
          subcategories={subcategories[scope]}
          stores={stores}
        />
      </Card>
    </div>
  );
}
