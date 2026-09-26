import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getGroceryMonth, getLabelOptions, getSubcategoryOptions } from "@/lib/data";
import { formatCurrency } from "@/lib/currency";
import { FOOD_CATEGORY } from "@/lib/categories";
import { formatDay, formatMonth, monthParam } from "@/lib/dates";
import { nameKey } from "@/lib/lists";
import { withParams } from "@/lib/urls";
import { copyGeneralList, deleteMealPrep } from "@/lib/actions/groceries";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { MonthSwitcher } from "@/components/ui/MonthSwitcher";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { AddGroceryForm } from "@/components/groceries/AddGroceryForm";
import { GroceryRow, type GroceryLine } from "@/components/groceries/GroceryRow";
import { MealPrepForm } from "@/components/groceries/MealPrepForm";
import { LogShopForm } from "@/components/groceries/LogShopForm";
import { CountUp } from "@/components/motion/CountUp";

type Search = { month?: string; show?: string; hide?: string };

export default async function GroceriesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { household } = await requireSession();
  const params = await searchParams;
  const month = monthParam(params.month);
  const show = params.show ?? "all";
  const hideBought = params.hide === "bought";
  const data = await getGroceryMonth(household.id, month);
  const monthName = formatMonth(month).split(" ")[0];

  const { totals, food } = data;
  const boughtPercent = totals.count ? Math.round((totals.boughtCount / totals.count) * 100) : 0;
  const dinners = data.mealPreps.reduce((sum, p) => sum + p.dinners, 0);
  const prepTotal = data.mealPreps.reduce((sum, p) => sum + p.totals.planned, 0);
  const foodSubcategories = getSubcategoryOptions(household.id, "shared")[nameKey(FOOD_CATEGORY)] ?? [];

  const filterParams = { month, show: show === "all" ? undefined : show, hide: hideBought ? "bought" : undefined };
  const chip = (label: string, value: string, count: number) => {
    const active = show === value;
    return (
      <Link
        key={value}
        href={withParams("/groceries", { ...filterParams, show: value === "all" ? undefined : value })}
        scroll={false}
        aria-pressed={active}
        className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
          active ? "bg-gold/15 text-gold ring-1 ring-inset ring-gold/40" : "bg-white/[0.05] text-ivory/65 hover:text-ivory"
        }`}
      >
        {label} <span className="ml-1 text-xs opacity-60">{count}</span>
      </Link>
    );
  };
  const visible = (lines: GroceryLine[]) => (hideBought ? lines.filter((l) => !l.bought) : lines);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Shared · Groceries" title="Groceries," accent={monthName}>
        <MonthSwitcher basePath="/groceries" month={month} params={{ show: filterParams.show, hide: filterParams.hide }} />
      </PageHeader>

      <Card className="overflow-hidden p-7 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative flex flex-col gap-10 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-display text-gradient-gold text-[clamp(3rem,8vw,5.5rem)] leading-[0.9]">
              <CountUp value={totals.planned} />
            </p>
            <p className="mt-3 text-lg text-ivory/60">planned for {monthName}&apos;s groceries</p>
            {food.planned > 0 ? (
              <div className="mt-6 max-w-lg">
                <ProgressBar
                  percent={Math.min(100, (totals.planned / food.planned) * 100)}
                  tone={totals.planned > food.planned ? "over" : "spend"}
                  label="Grocery plan against the Food & Toiletries budget"
                />
                <p className="mt-2 text-sm text-ivory/50">
                  {formatCurrency(totals.planned)} of your {formatCurrency(food.planned)} Food &amp; Toiletries budget
                  {food.spent > 0 && ` · ${formatCurrency(food.spent)} already spent on it this month`}
                </p>
              </div>
            ) : (
              <p className="mt-6 text-sm text-ivory/45">
                Set a Food &amp; Toiletries amount on the{" "}
                <Link href={`/budget?month=${month}`} className="text-gold hover:underline">
                  shared budget
                </Link>{" "}
                to compare this list against it.
              </p>
            )}
            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat label="Still to buy">{formatCurrency(totals.toBuy)}</Stat>
              <Stat label="In the trolley" tone="mint">
                {formatCurrency(totals.bought)}
              </Stat>
              <Stat label="Dinners planned">{dinners}</Stat>
              <Stat label="Per dinner" tone="gold">
                {dinners ? formatCurrency(prepTotal / dinners) : "—"}
              </Stat>
            </div>
          </div>
          <ProgressRing percent={boughtPercent} size={190} stroke={12} tone="growth" label="Share of the list bought">
            <div>
              <p className="font-display text-4xl tabular">
                {totals.boughtCount}/{totals.count}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ivory/45">in the trolley</p>
            </div>
          </ProgressRing>
        </div>
      </Card>

      {/* Cross-filter the list: one section at a time, and/or only what's left to buy. */}
      <div data-reveal className="flex flex-wrap items-center gap-2">
        {chip("Everything", "all", totals.count)}
        {chip("General", "general", data.general.length)}
        {data.mealPreps.map((p) => chip(p.name, p.id, p.items.length))}
        <Link
          href={withParams("/groceries", { ...filterParams, hide: hideBought ? undefined : "bought" })}
          scroll={false}
          aria-pressed={hideBought}
          className={`ml-auto whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
            hideBought ? "bg-mint/15 text-mint ring-1 ring-inset ring-mint/40" : "bg-white/[0.05] text-ivory/65 hover:text-ivory"
          }`}
        >
          {hideBought ? "✓ " : ""}Hide bought
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {(show === "all" || show === "general") && (
            <Card>
              <SectionTitle
                action={<span className="text-sm tabular text-ivory/50">{formatCurrency(data.generalTotals.planned)}</span>}
              >
                General
              </SectionTitle>
              {data.general.length === 0 ? (
                <div className="mb-5 flex flex-wrap items-center gap-4">
                  <p className="text-ivory/55">Nothing on the general list yet.</p>
                  {data.previousMonth && (
                    <form action={copyGeneralList.bind(null, month, data.previousMonth)}>
                      <SubmitButton variant="secondary" size="sm" pendingText="Copying…">
                        Start from {formatMonth(data.previousMonth)}&apos;s list
                      </SubmitButton>
                    </form>
                  )}
                </div>
              ) : (
                <ul className="mb-5 divide-y divide-white/[0.07]">
                  {visible(data.general).map((line) => (
                    <GroceryRow key={line.id} line={line} options={data.itemOptions} />
                  ))}
                  {visible(data.general).length === 0 && (
                    <li className="py-4 text-sm text-mint">Everything here is in the trolley.</li>
                  )}
                </ul>
              )}
              <AddGroceryForm month={month} options={data.itemOptions} startOpen={data.general.length === 0} />
            </Card>
          )}

          {data.mealPreps
            .filter((p) => show === "all" || show === p.id)
            .map((prep) => (
              <Card key={prep.id}>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold/80">
                      Meal prep{prep.cookOn && ` · cook ${formatDay(prep.cookOn)}`}
                    </p>
                    <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight">{prep.name}</h2>
                    <p className="mt-1 text-sm text-ivory/55">
                      {prep.dinners} dinner{prep.dinners === 1 ? "" : "s"} · {prep.items.length} ingredient
                      {prep.items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tabular">{formatCurrency(prep.totals.planned)}</p>
                    <p className="text-sm text-gold">{formatCurrency(prep.perDinner)} per dinner</p>
                  </div>
                </div>
                {prep.notes && <p className="mb-4 whitespace-pre-line rounded-2xl bg-white/[0.03] p-3 text-sm text-ivory/65">{prep.notes}</p>}
                {prep.items.length > 0 && (
                  <ul className="mb-5 divide-y divide-white/[0.07]">
                    {visible(prep.items).map((line) => (
                      <GroceryRow key={line.id} line={line} options={data.itemOptions} />
                    ))}
                    {visible(prep.items).length === 0 && (
                      <li className="py-4 text-sm text-mint">Every ingredient is in the trolley.</li>
                    )}
                  </ul>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <AddGroceryForm
                    month={month}
                    mealPrepId={prep.id}
                    options={data.itemOptions}
                    label="Add an ingredient"
                    startOpen={prep.items.length === 0}
                  />
                </div>
                <details className="group mt-5 border-t border-white/[0.07] pt-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-ivory/55 hover:text-ivory">
                    <span className="inline-block transition-transform duration-300 group-open:rotate-90">›</span> Edit meal prep
                  </summary>
                  <div className="mt-4 space-y-4">
                    <MealPrepForm month={month} mealPrep={prep} />
                    <form action={deleteMealPrep.bind(null, prep.id)}>
                      <ConfirmButton label="Delete meal prep" confirmLabel="Delete it and its ingredients?" />
                    </form>
                  </div>
                </details>
              </Card>
            ))}
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <SectionTitle>Plan a meal prep</SectionTitle>
            <MealPrepForm key={month} month={month} options={data.mealPrepOptions} />
          </Card>
          <Card>
            <SectionTitle>Log the shop</SectionTitle>
            <p className="-mt-2 mb-5 text-sm text-ivory/50">
              Back from the shops? Add what it cost to the shared budget as a Food &amp; Toiletries expense.
            </p>
            <LogShopForm
              suggested={totals.bought || totals.planned}
              stores={getLabelOptions(household.id, "store")}
              subcategories={foodSubcategories}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
