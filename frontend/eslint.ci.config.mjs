import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// CI-focused ESLint config:
// - Keep Next.js core/web-vitals signal
// - Relax legacy noise (explicit-any, require-imports, etc.) so CI can be a stable gate
export default defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "tests/**", // Playwright specs are gated separately
  ]),

  {
    rules: {
      // Too noisy for current codebase; keep for future tightening.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react/display-name": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "off",
    },
  },
]);

















