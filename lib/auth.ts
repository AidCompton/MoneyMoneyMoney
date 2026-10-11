import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { users, households } from "@/db/schema";

export interface SessionData {
  userId?: string;
  householdId?: string;
  /** The user's session version when this cookie was made (see users.sessionVersion). */
  v?: number;
}

const SESSION_DAYS = 30;

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters. Locally, run `npm install` again to create .env.local; " +
        "on Cloudflare, add it as a secret (see docs/deploy.md).",
    );
  }
  return secret;
}

/** Over HTTPS (production) the cookie is Secure and __Host- prefixed, so it can't be sent over plain HTTP or set by a subdomain. */
function sessionOptions() {
  const secure = process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1";
  return {
    password: sessionSecret(),
    cookieName: secure ? "__Host-mmm_session" : "mmm_session",
    ttl: SESSION_DAYS * 24 * 60 * 60,
    cookieOptions: { secure, httpOnly: true, sameSite: "lax" as const, path: "/" },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

/** Starts a fresh signed-in session for this user. */
export async function signIn(user: { id: string; householdId: string; sessionVersion: number }) {
  const session = await getSession();
  session.userId = user.id;
  session.householdId = user.householdId;
  session.v = user.sessionVersion;
  await session.save();
}

// Every user column except the password hash, which never leaves the auth code.
const safeUserColumns = Object.fromEntries(
  Object.entries(getTableColumns(users)).filter(([name]) => name !== "passwordHash"),
) as Omit<ReturnType<typeof getTableColumns<typeof users>>, "passwordHash">;

/**
 * The signed-in user and household, or null. A cookie only counts if its
 * user still exists, is still in that household, and hasn't signed out
 * everywhere (or changed password) since the cookie was made. Cached per
 * request, so the layout and page share one lookup.
 */
const loadSession = cache(async () => {
  const session = await getSession();
  if (!session.userId || !session.householdId) return null;
  const [row] = await db
    .select({ user: safeUserColumns, household: households })
    .from(users)
    .innerJoin(households, eq(households.id, users.householdId))
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!row || row.user.householdId !== session.householdId || row.user.sessionVersion !== session.v) return null;
  return { ...row, session };
});

export async function requireSession() {
  const signedIn = await loadSession();
  if (!signedIn) redirect("/login");
  return signedIn;
}

/** For route handlers: the signed-in user, or null (no redirect). */
export async function currentUser() {
  return (await loadSession())?.user ?? null;
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

// A hash of a random string, checked when the email isn't found so that a
// wrong email takes as long as a wrong password (no telling which emails exist).
const NO_SUCH_USER_HASH = "$2b$10$piYZGqG92SghP3GUqClOR.OHUppwS93n3Yiq0eNTs88t5SQh/UBSC";

export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (password.length > MAX_PASSWORD) return false;
  const matches = await bcrypt.compare(password, hash ?? NO_SUCH_USER_HASH);
  return matches && !!hash;
}

/** Problems with a new password, or null if it's fine. */
export function checkNewPassword(password: string, about: { email?: string; name?: string } = {}) {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters for your password.`;
  if (password.length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters for your password.`;
  const lower = password.toLowerCase();
  if (new Set(lower).size < 4) return "That password is too easy to guess.";
  if ((about.email && lower.includes(about.email.split("@")[0].toLowerCase())) || lower.includes("password")) {
    return "That password is too easy to guess.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Households
// ---------------------------------------------------------------------------

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 letters, no 0/O or 1/I

/** A random join code. 32 divides 256, so every letter is equally likely. */
export function generateJoinCode(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length]).join("");
}

/** The most people one household can hold (two, unless MAX_HOUSEHOLD_MEMBERS says otherwise). */
export function maxHouseholdMembers() {
  const n = Number(process.env.MAX_HOUSEHOLD_MEMBERS);
  return Number.isInteger(n) && n > 0 ? n : 2;
}

/**
 * Whether the sign-up page may create a new household: only for the very
 * first one, unless ALLOW_NEW_HOUSEHOLDS=true. Once your household exists,
 * nobody else on the internet can start one on your server.
 */
export async function canCreateHousehold() {
  if (process.env.ALLOW_NEW_HOUSEHOLDS === "true") return true;
  const [any] = await db.select({ id: households.id }).from(households).limit(1);
  return !any;
}
