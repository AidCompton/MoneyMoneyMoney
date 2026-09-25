"use client";

import { useActionState } from "react";
import { addActionItem, type ActionState } from "@/lib/actions/meetings";
import { Input } from "@/components/ui/Input";
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
    <form action={formAction} className="grid gap-4 sm:grid-cols-4">
      <input type="hidden" name="meetingId" value={meetingId} />
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="description">
          Action item
        </label>
        <Input id="description" name="description" placeholder="e.g. Move R2 000 to savings" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="assigneeUserId">
          Assign to
        </label>
        <select
          id="assigneeUserId"
          name="assigneeUserId"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">Either of us</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="dueDate">
          Due date (optional)
        </label>
        <Input id="dueDate" name="dueDate" type="date" />
      </div>
      <div className="sm:col-span-4">
        <FormError message={state.error} />
      </div>
      <div className="sm:col-span-4">
        <SubmitButton pendingText="Adding…">Add action item</SubmitButton>
      </div>
    </form>
  );
}
