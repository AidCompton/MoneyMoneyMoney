import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { receiptItems, receipts } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { colorForIndex } from "@/lib/categories";
import { formatCurrency, formatPrice } from "@/lib/currency";
import { formatLongDay } from "@/lib/dates";
import { deleteReceipt } from "@/lib/actions/receipts";
import { Card } from "@/components/ui/Card";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { ConfirmButton } from "@/components/ui/ConfirmButton";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, household } = await requireSession();
  const receipt = await db.query.receipts.findFirst({
    where: eq(receipts.id, id),
    with: {
      store: true,
      user: true,
      items: { orderBy: [asc(receiptItems.position)], with: { category: true, subcategory: true } },
    },
  });
  if (!receipt || receipt.householdId !== household.id) notFound();

  const canEdit = !receipt.ownerUserId || receipt.ownerUserId === user.id;
  const groups = new Map<string, typeof receipt.items>();
  for (const item of receipt.items) {
    const key = item.category?.name ?? "Uncategorised";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const back = receipt.ownerUserId ? `/personal/${receipt.ownerUserId}` : "/budget";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Receipt · ${formatLongDay(receipt.date)}`}
        title={receipt.store?.name ?? "Receipt"}
        tone={receipt.ownerUserId ? "mint" : "gold"}
      >
        <Link href={back} className="text-sm font-semibold text-gold hover:underline">
          ← Back to budget
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle action={<span className="font-display text-3xl tabular">{formatCurrency(receipt.total)}</span>}>
            {receipt.items.length} item{receipt.items.length === 1 ? "" : "s"}
          </SectionTitle>
          <div className="space-y-6">
            {[...groups.entries()].map(([category, items]) => (
              <div key={category}>
                <p className="mb-2 flex items-center justify-between text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: items[0].category ? colorForIndex(items[0].category.colorIndex) : "#7f918a" }}
                    />
                    {category}
                  </span>
                  <span className="tabular text-ivory/60">
                    {formatPrice(items.reduce((s, i) => s + i.lineTotal, 0))}
                  </span>
                </p>
                <ul className="divide-y divide-white/[0.07]">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="truncate text-xs text-ivory/40">
                          {item.quantity !== 1 && `${item.quantity} × ${formatPrice(item.unitPrice ?? 0)} · `}
                          {item.subcategory ? `${item.subcategory.name} · ` : ""}“{item.raw}”
                        </p>
                      </div>
                      <span className={`font-semibold tabular ${item.lineTotal < 0 ? "text-mint" : ""}`}>
                        {formatPrice(item.lineTotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-ivory/40">Scanned by {receipt.user.name}</p>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle>Photo</SectionTitle>
          {receipt.hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/receipts/${receipt.id}/image`} alt={`Receipt from ${receipt.store?.name ?? "the store"}`} className="w-full rounded-2xl" />
          ) : (
            <p className="text-sm text-ivory/50">No photo was kept for this receipt.</p>
          )}
        </Card>
      </div>

      {canEdit && (
        <div data-reveal className="flex justify-end">
          <form action={deleteReceipt.bind(null, receipt.id)}>
            <ConfirmButton label="Delete receipt" confirmLabel="Delete it and its expenses?" />
          </form>
        </div>
      )}
    </div>
  );
}
