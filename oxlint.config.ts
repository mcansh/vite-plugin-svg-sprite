import type { OxlintConfig } from "oxlint"
import { defineConfig } from "oxlint"

export const IGNORE_PATTERNS = [
  ".agent/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  ".continue/**",
  ".cursor/**",
  ".gemini/**",
  ".opencode/**",
  ".pi/**",
  ".roo/**",
  ".windsurf/**",
  "**/coverage/**",
  "node_modules/**",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tools/oxlint/anti-slop/**",
  "**/build/**",
  "**/dist/**",
] as const satisfies OxlintConfig["ignorePatterns"]

export default defineConfig({
  // Ensure only explicitly enabled rules are used.
  categories: {
    correctness: "off",
    nursery: "off",
    pedantic: "off",
    perf: "off",
    restriction: "off",
    style: "off",
    suspicious: "off",
  },
  env: {
    builtin: true,
  },
  ignorePatterns: IGNORE_PATTERNS,
  jsPlugins: [{ name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" }],
  options: {
    typeAware: true,
  },
  settings: {
    jsdoc: {
      ignorePrivate: true,
      tagNamePreference: {
        return: "return",
        category: "category",
      },
    },
  },
  rules: {
    "typescript/no-non-null-assertion": "error",
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": "error",
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
    "no-unused-vars": "off",
    "no-unused-expressions": "off",
    "no-useless-escape": "off",
    "no-async-promise-executor": "off",
    "no-control-regex": "off",
    "no-useless-catch": "off",
  },
  overrides: [
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["typescript", "import"],
      jsPlugins: [
        "./tools/oxlint/interface-pascal-case-plugin.ts",
        "./tools/oxlint/no-typescript-accessibility-plugin.ts",
      ],
      rules: {
        "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
        "typescript/consistent-type-imports": [
          "error",
          { prefer: "type-imports", fixStyle: "separate-type-imports" },
        ],
        "typescript/consistent-type-exports": [
          "error",
          { fixMixedExportsWithInlineTypeSpecifier: false },
        ],
        "import/extensions": ["error", "always", { ignorePackages: true }],
        "import/newline-after-import": "error",
        "remix-interface/interface-pascal-case": "error",
        "remix-typescript/no-typescript-accessibility": "error",
      },
    },
    {
      files: ["**/*.{ts,tsx,js,jsx}"],
      jsPlugins: [
        "./tools/oxlint/prefer-let-locals-plugin.ts",
        "./tools/oxlint/canonical-header-names-plugin.ts",
        "./tools/oxlint/jsx-no-leaked-render-plugin.ts",
      ],
      rules: {
        "remix-jsx/jsx-no-leaked-render": "error",
        "remix-headers/canonical-header-name": "error",
        "remix-style/prefer-const-module-scope": "error",
        "remix-style/prefer-let-locals": "error",
        "no-var": "error",
        "arrow-body-style": ["error", "as-needed"],
      },
    },
  ],
})
