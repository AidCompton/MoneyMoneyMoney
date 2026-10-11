import { defineConfig } from "@playwright/test";

// The security audit: attacks against a production build with production
// settings (secure cookies, sign-up closed after the first household, the
// Supabase roles simulated in Postgres). Run with `npm run test:security`.
export default defineConfig({
  testDir: "./e2e-security",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3300",
    trace: "retain-on-failure",
    // Page animations make Playwright wait for buttons to stop moving; the
    // audit is about the server, so skip them (also covers reduced motion).
    reducedMotion: "reduce",
    launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
  },
  webServer: {
    command: "node scripts/test-server.mjs --prod --port 3300",
    url: "http://127.0.0.1:3300/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { SECURITY_AUDIT: "1", INSECURE_COOKIES: "0", TEST_PG_PORT: "5435" },
  },
});
