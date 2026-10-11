"use server";

import { redirect } from "next/navigation";
import { count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import {
  MAX_PASSWORD,
  canCreateHousehold,
  checkNewPassword,
  generateJoinCode,
  getSession,
  hashPassword,
  maxHouseholdMembers,
  requireSession,
  signIn,
  verifyPassword,
} from "@/lib/auth";
import { ensureSharedCategories } from "@/lib/data/lists";
import { str } from "@/lib/form";
import { MINUTE, clearAttempts, clientIp, isLimited, recordAttempt, type Limit } from "@/lib/throttle";

export type ActionState = { error?: string; saved?: boolean };

const TOO_MANY = "Too many attempts. Please wait a while and try again.";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readPassword(fd: FormData, name = "password") {
  const value = fd.get(name);
  return typeof value === "string" ? value.slice(0, MAX_PASSWORD + 1) : "";
}

function readNewAccount(fd: FormData) {
  const name = str(fd, "name", 60);
  const email = str(fd, "email", 254).toLowerCase();
  const password = readPassword(fd);
  if (!name || !email || !password) return { error: "Please fill in every field." };
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  const weak = checkNewPassword(password, { email, name });
  if (weak) return { error: weak };
  return { name, email, password };
}

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";

async function signUpLimits(): Promise<Limit[]> {
  return [{ key: `signup-ip:${await clientIp()}`, max: 10, windowMs: 60 * MINUTE }];
}

export async function createHousehold(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const limits = await signUpLimits();
  if (await isLimited(limits)) return { error: TOO_MANY };
  await recordAttempt(limits);
  if (!(await canCreateHousehold())) {
    return { error: "New households can't be created here. Ask your partner for your household's join code." };
  }

  const householdName = str(fd, "householdName", 80);
  if (!householdName) return { error: "Please fill in every field." };
  const account = readNewAccount(fd);
  if ("error" in account) return { error: account.error };
  const passwordHash = await hashPassword(account.password);

  let user;
  try {
    user = await db.transaction(async (tx) => {
      const [household] = await tx
        .insert(households)
        .values({ name: householdName, joinCode: generateJoinCode() })
        .returning();
      await ensureSharedCategories(household.id, tx);
      const [created] = await tx
        .insert(users)
        .values({ householdId: household.id, name: account.name, email: account.email, passwordHash })
        .returning();
      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "That email is already registered. Sign in instead." };
    throw error;
  }

  await signIn(user);
  redirect("/dashboard");
}

export async function joinHousehold(_prev: ActionState, fd: FormData): Promise<ActionState> {
  // Each guess at a join code counts, so codes can't be found by trying many.
  const limits = [...(await signUpLimits()), { key: `join-ip:${await clientIp()}`, max: 10, windowMs: 60 * MINUTE }];
  if (await isLimited(limits)) return { error: TOO_MANY };
  await recordAttempt(limits);

  const joinCode = str(fd, "joinCode", 40).replace(/\s+/g, "").toUpperCase();
  if (!joinCode) return { error: "Please fill in every field." };
  const account = readNewAccount(fd);
  if ("error" in account) return { error: account.error };

  const household = /^[A-Z0-9]{4,12}$/.test(joinCode)
    ? await db.query.households.findFirst({ where: eq(households.joinCode, joinCode) })
    : undefined;
  if (!household) return { error: "We couldn't find a household with that code." };

  const passwordHash = await hashPassword(account.password);
  let user;
  try {
    user = await db.transaction(async (tx) => {
      // Lock the household row so two people joining at once can't both squeeze in.
      await tx.execute(sql`select 1 from ${households} where ${households.id} = ${household.id} for update`);
      const [{ n }] = await tx.select({ n: count() }).from(users).where(eq(users.householdId, household.id));
      if (n >= maxHouseholdMembers()) return null;
      const [created] = await tx
        .insert(users)
        .values({ householdId: household.id, name: account.name, email: account.email, passwordHash })
        .returning();
      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "That email is already registered. Sign in instead." };
    throw error;
  }
  if (!user) return { error: "That household is already full." };

  await signIn(user);
  redirect("/dashboard");
}

export async function login(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email", 254).toLowerCase();
  const password = readPassword(fd);
  const limits: Limit[] = [
    { key: `login-email:${email}`, max: 8, windowMs: 15 * MINUTE },
    { key: `login-ip:${await clientIp()}`, max: 30, windowMs: 15 * MINUTE },
  ];
  // Checked before the (deliberately slow) password check, so guessing can't run up the server's bill.
  if (await isLimited(limits)) return { error: TOO_MANY };

  const user = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : undefined;
  if (!(await verifyPassword(password, user?.passwordHash))) {
    await recordAttempt(limits);
    return { error: "Incorrect email or password." };
  }

  await clearAttempts([limits[0].key]);
  await signIn(user!);
  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

/** Changes your password and signs out every other device. */
export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const limits: Limit[] = [{ key: `password-user:${user.id}`, max: 8, windowMs: 15 * MINUTE }];
  if (await isLimited(limits)) return { error: TOO_MANY };

  const current = readPassword(fd, "currentPassword");
  const next = readPassword(fd, "newPassword");
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!(await verifyPassword(current, row?.passwordHash))) {
    await recordAttempt(limits);
    return { error: "Your current password isn't right." };
  }
  const weak = checkNewPassword(next, { email: user.email, name: user.name });
  if (weak) return { error: weak };
  if (next !== readPassword(fd, "confirmPassword")) return { error: "The new passwords don't match." };

  const [updated] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(next), sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, user.id))
    .returning();
  await clearAttempts([limits[0].key]);
  await signIn(updated);
  return { saved: true };
}

/** Signs out every other phone and computer; this one stays signed in. */
export async function signOutOtherDevices(): Promise<ActionState> {
  const { user } = await requireSession();
  const [updated] = await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, user.id))
    .returning();
  await signIn(updated);
  return { saved: true };
}
