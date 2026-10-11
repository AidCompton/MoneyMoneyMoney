// Where the app is running. Each host sets the visitor's address in its own
// header and strips any copy a visitor sends, so only that header is
// trusted; any other could be faked to dodge the per-address rate limits.

/** Cloudflare Workers (see docs/deploy.md). */
export const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

/** Netlify (see docs/deploy-netlify.md). HOSTED_ON is set at build time by next.config.ts. */
export const onNetlify = process.env.HOSTED_ON === "netlify";

/** The header holding the visitor's real address, or null when self-hosted. */
export const clientIpHeader = onWorkers ? "cf-connecting-ip" : onNetlify ? "x-nf-client-connection-ip" : null;
