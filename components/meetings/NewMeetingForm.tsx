"use client";

import { useActionState } from "react";
import { createMeeting, type ActionState } from "@/lib/actions/meetings";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function NewMeetingForm() {
  const [state, formAction] = useActionState(createMeeting, initialState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="date">
          Meeting date
        </label>
        <Input id="date" name="date" type="date" defaultValue={today} required />
      </div>
      <SubmitButton pendingText="Starting…">Start this week&apos;s meeting</SubmitButton>
      <div className="basis-full">
        <FormError message={state.error} />
      </div>
    </form>
  );
}
