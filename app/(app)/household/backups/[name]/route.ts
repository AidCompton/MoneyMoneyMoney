import fs from "node:fs";
import path from "node:path";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { households } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { BACKUP_NAME, backupDir } from "@/lib/backup";

/** Downloads one backup file, for keeping a copy somewhere else. Signed-in users only. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const session = await getSession();
  if (!session.userId) return new Response("Not signed in", { status: 401 });
  // A backup is the whole database. That's only yours to download when this
  // server holds nobody else's household.
  const total = db.select({ n: count() }).from(households).get()?.n ?? 0;
  if (total !== 1) return new Response("Downloads are only available for a single-household server", { status: 403 });

  const { name } = await params;
  // Only plain backup file names, so nothing outside the backups folder can be read.
  if (!BACKUP_NAME.test(name)) return new Response("Not found", { status: 404 });
  const file = path.join(backupDir(), name);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });

  return new Response(fs.readFileSync(file), {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="moneymoneymoney-${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
