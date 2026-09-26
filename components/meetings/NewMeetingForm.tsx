"use client";

import { useActionState } from "react";
import { todayISO } from "@/lib/dates";
import { createMeeting, type ActionState } from "@/lib/actions/meetings";
import { Input, Label } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function NewMeetingForm() {
  const [state, formAction] = useActionState(createMeeting, initialState);
  const today = todayISO();

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1 basis-48">
        <Label htmlFor="date">Meeting date</Label>
        <Input id="date" name="date" type="date" defaultValue={today} required />
      </div>
      <SubmitButton pendingText="Starting…">Start this week&apos;s meeting</SubmitButton>
      <FormError message={state.error} className="basis-full" />
    </form>
  );
}
