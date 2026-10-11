import os from "node:os";
import type { NextConfig } from "next";

// `npm run dev` only runs the page's scripts for addresses it has been told
// about. Allow this computer's own network addresses and name, plus the usual
// home-network ranges, so you can try the dev server from your phone.
const ownAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === "IPv4" && !i.internal)
  .map((i) => i.address);
const hostName = os.hostname().replace(/\.local$/, "");

const production = process.env.NODE_ENV === "production";

/**
 * What pages may load. Everything comes from this site: no third-party
 * scripts, fonts, images or connections, and the app can't be put in a frame
 * on another site. (Next.js puts its page data in inline scripts, hence
 * 'unsafe-inline' for scripts; React escapes everything it renders. The
 * receipt reader is WebAssembly, hence 'wasm-unsafe-eval', which allows
 * compiling WebAssembly but still not JavaScript's eval.)
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // Production only: dev needs eval and websockets for hot reload, and runs on plain HTTP.
  ...(production
    ? [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Which host this build is for, baked in at build time (lib/platform.ts).
  // Netlify sets NETLIFY=true during its builds; netlify.toml also sets it.
  env: {
    HOSTED_ON: process.env.HOSTED_ON ?? (process.env.NETLIFY === "true" ? "netlify" : ""),
  },
  allowedDevOrigins: [
    "127.0.0.1",
    ...ownAddresses,
    ...(hostName ? [`${hostName}.local`] : []),
    "*.local",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
