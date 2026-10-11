import { currentUser } from "@/lib/auth";
import { buildExport } from "@/lib/export";
import { todayISO } from "@/lib/dates";

/** Downloads everything your household has stored, as JSON. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Please sign in.", { status: 401 });

  const images = new URL(request.url).searchParams.get("images") === "1";
  const data = await buildExport(user.householdId, { images });
  return new Response(JSON.stringify(data, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="moneymoneymoney-${todayISO()}${images ? "-with-photos" : ""}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
