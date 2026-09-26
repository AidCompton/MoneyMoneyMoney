import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { scanReceipt } from "@/lib/receipts/server";

const MAX_BYTES = 15 * 1024 * 1024;

/** Receives a receipt photo and returns what could be read from it. */
export async function POST(request: Request) {
  const session = await getSession();
  const user = session.userId ? db.select().from(users).where(eq(users.id, session.userId)).get() : undefined;
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return Response.json({ error: "No photo was received." }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return Response.json({ error: "That photo is too large. Try again with a smaller one." }, { status: 413 });
  }

  try {
    const result = await scanReceipt(user.householdId, user.id, Buffer.from(await photo.arrayBuffer()));
    return Response.json(result);
  } catch (error) {
    console.error("Receipt scan failed", error);
    return Response.json(
      { error: "That photo couldn't be read. Make sure it's a picture of a receipt and try again." },
      { status: 422 },
    );
  }
}
