import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Runs before `npm run dev`, `build` and `start`. After a `git pull` that adds
// a package, the app would otherwise fail with "Module not found". Say what
// to do instead.

const root = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const missing = Object.keys(pkg.dependencies ?? {}).filter(
  (name) => !existsSync(path.join(root, "node_modules", name, "package.json")),
);

if (missing.length) {
  console.error(
    `\nSome packages this version needs aren't installed yet: ${missing.join(", ")}.\n` +
      `Run this once, then try again:\n\n    npm install\n`,
  );
  process.exit(1);
}
