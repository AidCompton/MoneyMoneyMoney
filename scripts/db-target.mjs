// Describes which database a connection string points at, without the
// password, so scripts can say where they're about to write. For Supabase it
// names the project ref, which is also in the dashboard's address
// (supabase.com/dashboard/project/<ref>).
export function describeDatabase(url) {
  try {
    const { hostname, port, pathname, username } = new URL(url);
    const ref =
      hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ?? // direct connection
      (hostname.endsWith(".pooler.supabase.com") ? username.split(".")[1] : undefined); // pooler
    const where = `${hostname}:${port || 5432}${pathname}`;
    return ref ? `Supabase project ${ref} (${where})` : where;
  } catch {
    return "an unreadable DATABASE_URL";
  }
}
