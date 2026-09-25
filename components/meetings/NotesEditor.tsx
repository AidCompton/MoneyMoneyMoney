"use client";

import { useActionState, useState } from "react";
import { updateNotes, type ActionState } from "@/lib/actions/meetings";
import { Textarea } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function NotesEditor({ meetingId, notes }: { meetingId: string; notes: string }) {
  const [state, formAction] = useActionState(updateNotes, initialState);
  // Hide "Saved" again as soon as the notes are edited after a save.
  const [dirty, setDirty] = useState(false);

  return (
    <form action={formAction} onSubmit={() => setDirty(false)} className="space-y-4">
      <input type="hidden" name="meetingId" value={meetingId} />
      <Textarea
        name="notes"
        aria-label="Meeting notes"
        defaultValue={notes}
        onChange={() => setDirty(true)}
        rows={9}
        placeholder="What did you decide? Anything to revisit next week?"
      />
      <FormError message={state.error} />
      <div className="flex items-center gap-4">
        <SubmitButton pendingText="Saving…">Save notes</SubmitButton>
        {state.saved && !dirty && (
          <span role="status" className="row-enter text-sm font-medium text-mint">
            ✓ Saved
          </span>
        )}
      </div>
    </form>
  );
}
