"use client";

import { useActionState, useState } from "react";
import { deleteListEntry, renameListEntry, type ActionState, type ListKind } from "@/lib/actions/lists";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: ActionState = {};

/**
 * One pick-list entry. Renaming it to the name of another entry merges the
 * two, which is how typos get cleaned up.
 */
export function ListEntry({
  kind,
  id,
  name,
  uses,
  detail,
  color,
  canDelete = true,
  locked = false,
}: {
  kind: ListKind;
  id: string;
  name: string;
  uses: number;
  detail?: string;
  color?: string;
  canDelete?: boolean;
  locked?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await renameListEntry(prev, fd);
    if (!result.error) setEditing(false);
    return result;
  }, initialState);

  if (editing) {
    return (
      <li className="row-enter py-2">
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <Input name="name" defaultValue={name} aria-label={`New name for ${name}`} autoFocus className="py-2" />
          <SubmitButton size="sm" pendingText="…">
            Save
          </SubmitButton>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
        {state.error && <p className="mt-1 text-xs text-coral">{state.error}</p>}
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 py-2">
      {color && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-ivory/40">
          {uses === 0 ? "Not used yet" : `Used ${uses} time${uses === 1 ? "" : "s"}`}
          {detail && ` · ${detail}`}
          {state.merged && <span className="text-mint"> · merged into {state.merged}</span>}
        </p>
      </div>
      {locked ? (
        <span className="text-xs text-ivory/35">Fixed</span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full px-3 py-1 text-xs font-semibold text-ivory/50 transition-colors hover:bg-white/[0.07] hover:text-gold"
          >
            Rename
          </button>
          {canDelete && (
            <form action={deleteListEntry.bind(null, kind, id)}>
              <ConfirmButton icon label={`Delete ${name}`} />
            </form>
          )}
        </>
      )}
    </li>
  );
}
