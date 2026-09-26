"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import { getSession, hashPassword, verifyPassword, generateJoinCode } from "@/lib/auth";
import { ensureSharedCategories } from "@/lib/data/lists";

export type ActionState = { error?: string };

export async function createHousehold(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const householdName = String(formData.get("householdName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!householdName || !name || !email || !password) {
    return { error: "Please fill in every field." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return { error: "That email is already registered." };
  }

  let joinCode = generateJoinCode();
  while (await db.query.households.findFirst({ where: eq(households.joinCode, joinCode) })) {
    joinCode = generateJoinCode();
  }

  const [household] = await db
    .insert(households)
    .values({ name: householdName, joinCode })
    .returning();
  ensureSharedCategories(household.id);
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ householdId: household.id, name, email, passwordHash })
    .returning();

  const session = await getSession();
  session.userId = user.id;
  session.householdId = household.id;
  await session.save();

  redirect("/dashboard");
}

export async function joinHousehold(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const joinCode = String(formData.get("joinCode") ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!joinCode || !name || !email || !password) {
    return { error: "Please fill in every field." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const household = await db.query.households.findFirst({
    where: eq(households.joinCode, joinCode),
  });
  if (!household) {
    return { error: "We couldn't find a household with that code." };
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return { error: "That email is already registered." };
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ householdId: household.id, name, email, passwordHash })
    .returning();

  const session = await getSession();
  session.userId = user.id;
  session.householdId = household.id;
  await session.save();

  redirect("/dashboard");
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  const session = await getSession();
  session.userId = user.id;
  session.householdId = user.householdId;
  await session.save();

  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
