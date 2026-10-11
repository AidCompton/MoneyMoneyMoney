import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

// Local development settings (.env.local). It is never committed, and the
// deployed app gets its own secret from Cloudflare instead (docs/deploy.md).

const envPath = path.join(process.cwd(), ".env.local");
const LOCAL_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5433/moneymoneymoney";

if (!existsSync(envPath)) {
  const secret = randomBytes(32).toString("hex");
  writeFileSync(
    envPath,
    `# Local development settings - keep this file private. Never committed.\n` +
      `SESSION_SECRET=${secret}\n` +
      `# The local database from \`npm run db:local\`.\n` +
      `DATABASE_URL=${LOCAL_DATABASE_URL}\n`,
  );
  console.log("Created .env.local with a new SESSION_SECRET.");
} else if (!/^DATABASE_URL=/m.test(readFileSync(envPath, "utf8"))) {
  appendFileSync(envPath, `# The local database from \`npm run db:local\`.\nDATABASE_URL=${LOCAL_DATABASE_URL}\n`);
  console.log("Added the local DATABASE_URL to .env.local.");
}
