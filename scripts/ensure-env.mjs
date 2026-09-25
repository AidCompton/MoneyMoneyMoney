import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");

if (!existsSync(envPath)) {
  const secret = randomBytes(32).toString("hex");
  writeFileSync(
    envPath,
    `# Generated automatically on first install - keep this file private.\n` +
      `# It only ever lives on this machine; nothing here is sent anywhere.\n` +
      `SESSION_SECRET=${secret}\n`,
  );
  console.log("Created .env.local with a new SESSION_SECRET.");
}
