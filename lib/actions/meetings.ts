"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { moneyMeetings, actionItems, users } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { MAX_NOTES, isISODate, isId, str } from "@/lib/form";

export type ActionState = { error?: string; saved?: boolean };

async function ownedMeeting(meetingId: string, householdId: string) {
  if (!isId(meetingId)) return null;
  const meeting = await db.query.moneyMeetings.findFirst({
    where: and(eq(moneyMeetings.id, meetingId), eq(moneyMeetings.householdId, householdId)),
  });
  return meeting ?? null;
}

/** An action item on one of this household's meetings. */
async function ownedItem(itemId: string, householdId: string) {
  if (!isId(itemId)) return null;
  const [row] = await db
    .select({ item: actionItems })
    .from(actionItems)
    .innerJoin(moneyMeetings, eq(moneyMeetings.id, actionItems.meetingId))
    .where(and(eq(actionItems.id, itemId), eq(moneyMeetings.householdId, householdId)))
    .limit(1);
  return row?.item ?? null;
}

export async function createMeeting(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { household } = await requireSession();

  const date = str(fd, "date");
  if (!isISODate(date)) return { error: "Pick a date for this meeting." };

  const [meeting] = await db.insert(moneyMeetings).values({ householdId: household.id, date, notes: "" }).returning();

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  redirect(`/meetings/${meeting.id}`);
}

export async function updateNotes(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { household } = await requireSession();

  const meeting = await ownedMeeting(str(fd, "meetingId"), household.id);
  if (!meeting) return { error: "That meeting could not be found." };
  const raw = fd.get("notes");
  const notes = typeof raw === "string" ? raw : "";
  if (notes.length > MAX_NOTES) return { error: "Those notes are too long. Split them across meetings." };

  await db.update(moneyMeetings).set({ notes }).where(eq(moneyMeetings.id, meeting.id));

  revalidatePath(`/meetings/${meeting.id}`);
  return { saved: true };
}

export async function addActionItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { household } = await requireSession();

  const meeting = await ownedMeeting(str(fd, "meetingId"), household.id);
  if (!meeting) return { error: "That meeting could not be found." };
  const description = str(fd, "description");
  const assignee = str(fd, "assigneeUserId") || null;
  const dueDate = str(fd, "dueDate") || null;
  if (!description) return { error: "Describe the action item." };
  if (dueDate && !isISODate(dueDate)) return { error: "Pick a valid due date." };
  if (assignee) {
    // Only someone in this household can be given a task.
    const member = isId(assignee)
      ? await db.query.users.findFirst({ where: and(eq(users.id, assignee), eq(users.householdId, household.id)) })
      : undefined;
    if (!member) return { error: "Pick someone in your household." };
  }

  await db.insert(actionItems).values({ meetingId: meeting.id, description, assigneeUserId: assignee, dueDate });

  revalidatePath(`/meetings/${meeting.id}`);
  return {};
}

export async function toggleActionItem(itemId: string, meetingId: string) {
  const { household } = await requireSession();
  const item = await ownedItem(itemId, household.id);
  if (!item || item.meetingId !== meetingId) return;

  await db.update(actionItems).set({ done: !item.done }).where(eq(actionItems.id, item.id));

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/dashboard");
}

export async function carryOverItem(itemId: string, targetMeetingId: string) {
  const { household } = await requireSession();

  const meeting = await ownedMeeting(targetMeetingId, household.id);
  const item = await ownedItem(itemId, household.id);
  if (!meeting || !item) return;

  await db.update(actionItems).set({ meetingId: meeting.id }).where(eq(actionItems.id, item.id));

  revalidatePath(`/meetings/${meeting.id}`);
  revalidatePath(`/meetings/${item.meetingId}`);
  revalidatePath("/dashboard");
}

export async function deleteActionItem(itemId: string, meetingId: string) {
  const { household } = await requireSession();
  const item = await ownedItem(itemId, household.id);
  if (!item || item.meetingId !== meetingId) return;

  await db.delete(actionItems).where(eq(actionItems.id, item.id));

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/dashboard");
}

export async function deleteMeeting(meetingId: string) {
  const { household } = await requireSession();

  const meeting = await ownedMeeting(meetingId, household.id);
  if (!meeting) return;

  // Its action items go with it (ON DELETE CASCADE).
  await db.delete(moneyMeetings).where(eq(moneyMeetings.id, meeting.id));

  revalidatePath("/meetings");
  revalidatePath("/dashboard");
  redirect("/meetings");
}
