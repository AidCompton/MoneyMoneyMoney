import fs from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { receipts, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { receiptImagePath } from "@/lib/receipts/server";

/** A saved receipt's photo, for members of the household it belongs to. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const user = session.userId ? db.select().from(users).where(eq(users.id, session.userId)).get() : undefined;
  const receipt = db.select().from(receipts).where(eq(receipts.id, id)).get();
  if (!user || !receipt || receipt.householdId !== user.householdId || !receipt.hasImage) {
    return new Response("Not found", { status: 404 });
  }
  const file = receiptImagePath(receipt.id);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
}
