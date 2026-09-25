"use client";

import { useActionState } from "react";
import { updateNotes, type ActionState } from "@/lib/actions/meetings";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function NotesEditor({ meetingId, notes }: { meetingId: string; notes: string }) {
  const [state, formAction] = useActionState(updateNotes, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="meetingId" value={meetingId} />
      <textarea
        name="notes"
        defaultValue={notes}
        rows={8}
        placeholder="What did you decide? Anything to revisit next week?"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
      <FormError message={state.error} />
      <SubmitButton pendingText="Saving…">Save notes</SubmitButton>
    </form>
  );
}
