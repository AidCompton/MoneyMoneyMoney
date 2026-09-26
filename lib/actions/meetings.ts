"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { moneyMeetings, actionItems } from "@/db/schema";
import { requireSession } from "@/lib/auth";

export type ActionState = { error?: string; saved?: boolean };

export async function createMeeting(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { household } = await requireSession();

  const date = String(formData.get("date") ?? "").trim();
  if (!date) {
    return { error: "Pick a date for this meeting." };
  }

  const [meeting] = await db
    .insert(moneyMeetings)
    .values({ householdId: household.id, date, notes: "" })
    .returning();

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  redirect(`/meetings/${meeting.id}`);
}

async function assertOwnedMeeting(meetingId: string, householdId: string) {
  const meeting = await db.query.moneyMeetings.findFirst({
    where: eq(moneyMeetings.id, meetingId),
  });
  if (!meeting || meeting.householdId !== householdId) {
    return null;
  }
  return meeting;
}

export async function updateNotes(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { household } = await requireSession();

  const meetingId = String(formData.get("meetingId") ?? "");
  const notes = String(formData.get("notes") ?? "");

  const meeting = await assertOwnedMeeting(meetingId, household.id);
  if (!meeting) {
    return { error: "That meeting could not be found." };
  }

  await db.update(moneyMeetings).set({ notes }).where(eq(moneyMeetings.id, meetingId));

  revalidatePath(`/meetings/${meetingId}`);
  return { saved: true };
}

export async function addActionItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { household } = await requireSession();

  const meetingId = String(formData.get("meetingId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const assigneeUserId = String(formData.get("assigneeUserId") ?? "") || null;
  const dueDate = String(formData.get("dueDate") ?? "").trim() || null;

  const meeting = await assertOwnedMeeting(meetingId, household.id);
  if (!meeting) {
    return { error: "That meeting could not be found." };
  }
  if (!description) {
    return { error: "Describe the action item." };
  }

  await db.insert(actionItems).values({ meetingId, description, assigneeUserId, dueDate });

  revalidatePath(`/meetings/${meetingId}`);
  return {};
}

export async function toggleActionItem(itemId: string, meetingId: string) {
  const { household } = await requireSession();

  const meeting = await assertOwnedMeeting(meetingId, household.id);
  if (!meeting) return;

  const item = await db.query.actionItems.findFirst({ where: eq(actionItems.id, itemId) });
  if (!item || item.meetingId !== meetingId) return;

  await db.update(actionItems).set({ done: !item.done }).where(eq(actionItems.id, itemId));

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/dashboard");
}

export async function carryOverItem(itemId: string, targetMeetingId: string) {
  const { household } = await requireSession();

  const meeting = await assertOwnedMeeting(targetMeetingId, household.id);
  if (!meeting) return;

  const item = await db.query.actionItems.findFirst({ where: eq(actionItems.id, itemId) });
  if (!item) return;

  const sourceMeeting = await assertOwnedMeeting(item.meetingId, household.id);
  if (!sourceMeeting) return;

  await db
    .update(actionItems)
    .set({ meetingId: targetMeetingId })
    .where(eq(actionItems.id, itemId));

  revalidatePath(`/meetings/${targetMeetingId}`);
  revalidatePath(`/meetings/${item.meetingId}`);
  revalidatePath("/dashboard");
}

export async function deleteActionItem(itemId: string, meetingId: string) {
  const { household } = await requireSession();

  const meeting = await assertOwnedMeeting(meetingId, household.id);
  if (!meeting) return;

  const item = await db.query.actionItems.findFirst({ where: eq(actionItems.id, itemId) });
  if (!item || item.meetingId !== meetingId) return;

  await db.delete(actionItems).where(eq(actionItems.id, itemId));

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/dashboard");
}

export async function deleteMeeting(meetingId: string) {
  const { household } = await requireSession();

  const meeting = await assertOwnedMeeting(meetingId, household.id);
  if (!meeting) return;

  // Its action items go with it (ON DELETE CASCADE).
  await db.delete(moneyMeetings).where(eq(moneyMeetings.id, meetingId));

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  redirect("/meetings");
}
