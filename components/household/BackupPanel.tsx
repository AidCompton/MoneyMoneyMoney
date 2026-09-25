"use client";

import { useActionState } from "react";
import { backupNow, type BackupState } from "@/lib/actions/backup";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FormError } from "@/components/ui/FormError";

type Backup = { name: string; size: number; createdAt: string };

const initialState: BackupState = {};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "Back up now", plus the most recent backups to download. */
export function BackupPanel({ backups }: { backups: Backup[] }) {
  const [state, formAction] = useActionState(backupNow, initialState);
  const recent = backups.slice(0, 5);

  return (
    <div className="space-y-5">
      <form action={formAction} className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingText="Backing up…">Back up now</SubmitButton>
        {state.name && (
          <span role="status" className="row-enter text-sm font-medium text-mint">
            ✓ Saved a backup
          </span>
        )}
      </form>
      <FormError message={state.error} />
      {recent.length === 0 ? (
        <p className="text-sm text-ivory/50">No backups yet.</p>
      ) : (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory/45">
            Latest backups{backups.length > recent.length && ` · ${backups.length} in total`}
          </p>
          <ul className="divide-y divide-white/[0.07]">
            {recent.map((b) => (
              <li key={b.name} className="row-enter flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  {when(b.createdAt)} <span className="text-ivory/40">· {size(b.size)}</span>
                </span>
                <a
                  href={`/household/backups/${b.name}`}
                  download
                  className="shrink-0 font-semibold text-gold hover:underline"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
