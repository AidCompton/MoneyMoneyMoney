import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Every database call is async: a forgotten `await` silently skips the
  // write or the check, so make it an error.
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.ts", "db/**/*.ts", "components/**/*.tsx"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated or copied in, not ours:
    ".open-next/**",
    ".wrangler/**",
    ".postgres/**",
    "public/ocr/**",
    "cloudflare-env.d.ts",
  ]),
]);

export default eslintConfig;
