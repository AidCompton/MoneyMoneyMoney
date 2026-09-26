import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, households } from "@/db/schema";

export interface SessionData {
  userId?: string;
  householdId?: string;
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error(
    "SESSION_SECRET is not set. Run `npm install` again so scripts/ensure-env.mjs can create .env.local.",
  );
}

export const sessionOptions = {
  password: sessionSecret,
  cookieName: "moneymoneymoney_session",
  cookieOptions: {
    // This app is served over plain HTTP on your home network, never HTTPS.
    secure: false,
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session.userId || !session.householdId) {
    redirect("/login");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  const household = await db.query.households.findFirst({
    where: eq(households.id, session.householdId),
  });

  if (!user || !household) {
    // Can't destroy the cookie from here (this runs during render, not a
    // Server Action), but logging in again overwrites it regardless.
    redirect("/login");
  }

  return { user, household, session };
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}
