import "server-only";
import { headers } from "next/headers";

/**
 * This site's own address as the visitor sees it, e.g.
 * https://moneymoneymoney.example.workers.dev. Used for links and QR codes
 * you share (join link, phone setup), so it's whatever address you're on.
 */
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
