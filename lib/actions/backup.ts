"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createBackup } from "@/lib/backup";

export type BackupState = { error?: string; name?: string };

/** The Household page's "Back up now" button. */
export async function backupNow(): Promise<BackupState> {
  await requireSession();
  try {
    const name = await createBackup();
    revalidatePath("/household");
    return { name };
  } catch (error) {
    console.error("Backup failed", error);
    return { error: "The backup couldn't be written. Check there's free disk space and try again." };
  }
}
