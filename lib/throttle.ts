import "server-only";
import { headers } from "next/headers";
import { inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { authThrottle } from "@/db/schema";

// Rate limiting for sign-in, joining and sign-up, kept in the database so it
// holds across every server instance. Each key ("login-email:aid@x.com",
// "login-ip:203.0.113.7") counts attempts within a rolling window; once a key
// reaches its limit, further attempts are refused until the window passes.

export type Limit = { key: string; max: number; windowMs: number };

export const MINUTE = 60_000;

/** The caller's IP address. Cloudflare sets CF-Connecting-IP and clients can't override it. */
export async function clientIp() {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** True when any of these keys has used up its attempts. */
export async function isLimited(limits: Limit[]) {
  if (!limits.length) return false;
  const rows = await db
    .select()
    .from(authThrottle)
    .where(
      inArray(
        authThrottle.key,
        limits.map((l) => l.key),
      ),
    );
  const now = Date.now();
  return limits.some((limit) => {
    const row = rows.find((r) => r.key === limit.key);
    return !!row && row.windowStart.getTime() > now - limit.windowMs && row.count >= limit.max;
  });
}

/** Counts one attempt against each key, starting a new window where the old one has passed. */
export async function recordAttempt(limits: Limit[]) {
  const now = new Date();
  for (const limit of limits) {
    const cutoff = sql`${new Date(now.getTime() - limit.windowMs).toISOString()}::timestamptz`;
    const restart = sql`${now.toISOString()}::timestamptz`;
    await db
      .insert(authThrottle)
      .values({ key: limit.key, count: 1, windowStart: now })
      .onConflictDoUpdate({
        target: authThrottle.key,
        set: {
          count: sql`case when ${authThrottle.windowStart} < ${cutoff} then 1 else ${authThrottle.count} + 1 end`,
          windowStart: sql`case when ${authThrottle.windowStart} < ${cutoff} then ${restart} else ${authThrottle.windowStart} end`,
        },
      });
  }
  // Now and then, forget attempts from more than a day ago.
  if (Math.random() < 0.05) {
    await db.delete(authThrottle).where(lt(authThrottle.windowStart, new Date(now.getTime() - 24 * 60 * MINUTE)));
  }
}

export async function clearAttempts(keys: string[]) {
  if (keys.length) await db.delete(authThrottle).where(inArray(authThrottle.key, keys));
}
