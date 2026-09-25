// Where everything lives. The app has four spaces: the combined overview,
// shared money, each person's personal money, and household settings.

export type Space = "overview" | "shared" | "personal" | "household";

export type NavLink = { href: string; label: string; key: string };

export function spaceOf(pathname: string): Space {
  if (pathname.startsWith("/personal")) return "personal";
  if (pathname.startsWith("/household")) return "household";
  if (pathname.startsWith("/dashboard")) return "overview";
  return "shared";
}

export function primaryLinks(userId: string): NavLink[] {
  return [
    { key: "overview", href: "/dashboard", label: "Overview" },
    { key: "shared", href: "/budget", label: "Shared" },
    { key: "personal", href: `/personal/${userId}`, label: "Personal" },
    { key: "household", href: "/household", label: "Household" },
  ];
}

export function subLinks(space: Space, pathname: string): NavLink[] {
  if (space === "shared") {
    return [
      { key: "/budget", href: "/budget", label: "Budget" },
      { key: "/groceries", href: "/groceries", label: "Groceries" },
      { key: "/goals", href: "/goals", label: "Goals" },
      { key: "/meetings", href: "/meetings", label: "Meetings" },
    ];
  }
  if (space === "personal") {
    const personId = pathname.split("/")[2] ?? "";
    const base = `/personal/${personId}`;
    return [
      { key: base, href: base, label: "Budget" },
      { key: `${base}/savings`, href: `${base}/savings`, label: "Savings" },
    ];
  }
  if (space === "household") {
    return [
      { key: "/household", href: "/household", label: "Members" },
      { key: "/household/lists", href: "/household/lists", label: "Lists" },
    ];
  }
  return [];
}

/** The most specific link that contains the current path. */
export function activeKey(links: NavLink[], pathname: string) {
  return links
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.key;
}
