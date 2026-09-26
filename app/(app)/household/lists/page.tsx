import { requireSession } from "@/lib/auth";
import { getListsForManagement } from "@/lib/data";
import { formatPrice } from "@/lib/currency";
import { Card } from "@/components/ui/Card";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { ListEntry } from "@/components/lists/ListEntry";

export default async function ListsPage() {
  const { household } = await requireSession();
  const lists = getListsForManagement(household.id);
  const labelsOf = (kind: string) => lists.labels.filter((l) => l.kind === kind);
  const shared = lists.categories.filter((c) => c.scope === "shared");
  const personal = lists.categories.filter((c) => c.scope === "personal");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Household · Lists" title="Your lists," accent="tidy." />
      <p data-reveal className="max-w-2xl text-ivory/60">
        Everything you type once (stores, sub-categories, groceries and so on) is kept here so it can be picked from a
        dropdown next time. Fix a typo by renaming it; rename it to an existing name to merge the two.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        {(
          [
            ["store", "Stores", "Stores appear here as you add expenses."],
            ["income_source", "Income sources", "Add income on a personal page to start this list."],
            ["savings_tag", "Savings sub-categories", "Tag deposits and withdrawals to start this list."],
          ] as const
        ).map(([kind, title, empty]) => (
          <Card key={kind}>
            <SectionTitle>{title}</SectionTitle>
            {labelsOf(kind).length === 0 ? (
              <Empty>{empty}</Empty>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {labelsOf(kind).map((l) => (
                  <ListEntry key={l.id} kind={kind} id={l.id} name={l.name} uses={l.uses} />
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Shared categories &amp; sub-categories</SectionTitle>
          <div className="space-y-5">
            {shared.map((c) => (
              <div key={c.id}>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  {c.name}
                  <span className="text-xs font-normal text-ivory/35">fixed</span>
                </p>
                {c.subcategories.length > 0 ? (
                  <ul className="ml-4 mt-1 divide-y divide-white/[0.06] border-l border-white/[0.08] pl-4">
                    {c.subcategories.map((s) => (
                      <ListEntry key={s.id} kind="subcategory" id={s.id} name={s.name} uses={s.uses} />
                    ))}
                  </ul>
                ) : (
                  <p className="ml-8 mt-1 text-xs text-ivory/35">No sub-categories yet</p>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Personal categories &amp; sub-categories</SectionTitle>
          {personal.length === 0 ? (
            <Empty>Personal categories appear here once either of you plans or spends in one.</Empty>
          ) : (
            <div className="space-y-5">
              {personal.map((c) => (
                <div key={c.id}>
                  <ul>
                    <ListEntry
                      kind="personal_category"
                      id={c.id}
                      name={c.name}
                      uses={c.uses}
                      color={c.color}
                      detail={c.planned ? `planned in ${c.planned} month${c.planned === 1 ? "" : "s"}` : undefined}
                      canDelete={c.uses === 0}
                    />
                  </ul>
                  {c.subcategories.length > 0 && (
                    <ul className="ml-4 mt-1 divide-y divide-white/[0.06] border-l border-white/[0.08] pl-4">
                      {c.subcategories.map((s) => (
                        <ListEntry key={s.id} kind="subcategory" id={s.id} name={s.name} uses={s.uses} />
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>Groceries</SectionTitle>
        {lists.groceryItems.length === 0 ? (
          <Empty>Groceries appear here once you add them to a list.</Empty>
        ) : (
          <ul className="grid gap-x-8 divide-y divide-white/[0.06] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
            {lists.groceryItems.map((g) => (
              <ListEntry
                key={g.id}
                kind="grocery_item"
                id={g.id}
                name={g.name}
                uses={g.uses}
                detail={[g.size, g.price !== null ? `last ${formatPrice(g.price)}` : null].filter(Boolean).join(", ") || undefined}
                canDelete={g.uses === 0}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-sm text-ivory/45">{children}</p>;
}
