import Link from "next/link";
import { formatMonth, shiftMonth } from "@/lib/dates";
import { withParams } from "@/lib/urls";

/** ← Month → pill. Keeps any other params (like filters) when moving between months. */
export function MonthSwitcher({
  basePath,
  month,
  params = {},
}: {
  basePath: string;
  month: string;
  params?: Record<string, string | undefined>;
}) {
  const link = (m: string) => withParams(basePath, { ...params, month: m });
  const arrow =
    "grid h-10 w-10 place-items-center rounded-full text-ivory/70 transition-colors hover:bg-white/10 hover:text-ivory";
  return (
    <div className="glass flex items-center gap-1 rounded-full p-1">
      <Link href={link(shiftMonth(month, -1))} aria-label="Previous month" className={arrow} scroll={false}>
        ←
      </Link>
      <span className="min-w-32 px-2 text-center text-sm font-semibold">{formatMonth(month)}</span>
      <Link href={link(shiftMonth(month, 1))} aria-label="Next month" className={arrow} scroll={false}>
        →
      </Link>
    </div>
  );
}
