import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    "dist-electron/**",
    "playwright-report/**",
    "storybook-static/**",
    "test-results/**",
    "android/app/build/**",
    "src-tauri/target/**",
  ]),
  {
    files: [
      "app/(public)/landing.tsx",
      "app/auth/confirm/page.tsx",
      "app/control-plane/page.tsx",
      "app/dev-kit/status/page.tsx",
      "app/observability/page.tsx",
      "app/profile/page.tsx",
      "app/record/page.tsx",
      "app/settings/integrations/page.tsx",
      "app/settings/recipes/page.tsx",
      "components/chat-input.tsx",
      "components/live-recorder.tsx",
      "components/live-transcript-view.tsx",
      "components/session-workspace.tsx",
      "components/theme-toggle.tsx",
      "components/ui/liquid-glass-button.tsx",
      "lib/hooks/use-stick-to-bottom.ts",
      // PROD-389 onboarding: the tour popover measures its anchor in a
      // layout effect to position itself; the toast derives visibility
      // from onboarding state but keeps a local dismissed flag. Both are
      // legitimate exceptions to the React Compiler's stricter rules.
      "components/onboarding/first-meeting-toast.tsx",
      "components/onboarding/tour-popover.tsx",
    ],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    files: ["tests/e2e/**/*.ts"],
    rules: {
      // Playwright fixture callbacks are commonly named `use`; they are not
      // React hooks and should not be checked by the hooks rule.
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    files: ["tests/mocks/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["app/api/dev-kit/**/*.ts", "app/dev-kit/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "app/dev-kit/cost/page.tsx",
      "lib/ai-call.ts",
      "lib/ai-dev-kit/telemetry-persistence.ts",
      "lib/ai/telemetry.ts",
      "lib/project.config.ts",
      "scripts/check-brand-compliance.mts",
      "scripts/check-budget.ts",
      "scripts/check-code-review.mts",
      "scripts/check-impl-doc-diff.mts",
      "scripts/generate-expect-from-manifest.ts",
      "scripts/generate-playwright-from-manifest.ts",
      "scripts/sync-dependencies.ts",
    ],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  {
    files: ["electron/**/*.js", "scripts/check-docs-lookup-coverage.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["types/**/*.d.ts", "lib/ai/devtools.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
