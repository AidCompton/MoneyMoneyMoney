import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { receiptImages, receipts } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { isId } from "@/lib/form";

/** A saved receipt's photo, for members of the household it belongs to. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user || !isId(id)) return new Response("Not found", { status: 404 });

  const [row] = await db
    .select({ data: receiptImages.data, contentType: receiptImages.contentType })
    .from(receiptImages)
    .innerJoin(receipts, eq(receipts.id, receiptImages.receiptId))
    .where(and(eq(receipts.id, id), eq(receipts.householdId, user.householdId)))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.contentType === "image/jpeg" ? "image/jpeg" : "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
