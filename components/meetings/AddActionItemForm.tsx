"use client";

import { useActionState } from "react";
import { addActionItem, type ActionState } from "@/lib/actions/meetings";
import { Input, Label, Select } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

const initialState: ActionState = {};

export function AddActionItemForm({
  meetingId,
  members,
}: {
  meetingId: string;
  members: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(addActionItem, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="meetingId" value={meetingId} />
      <div className="sm:col-span-2">
        <Label htmlFor="description">Action item</Label>
        <Input id="description" name="description" placeholder="e.g. Move R2 000 to savings" required />
      </div>
      <div>
        <Label htmlFor="assigneeUserId">Assign to</Label>
        <Select id="assigneeUserId" name="assigneeUserId">
          <option value="">Either of us</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="dueDate">Due date (optional)</Label>
        <Input id="dueDate" name="dueDate" type="date" />
      </div>
      <FormError message={state.error} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Adding…">Add action item</SubmitButton>
      </div>
    </form>
  );
}
