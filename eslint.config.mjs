import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import prettier from "eslint-config-prettier";

export default defineConfig([
  globalIgnores([
    "node_modules/",
    "main.js",
    "coverage/",
    "esbuild.config.mjs",
    "version-bump.mjs",
    "test/fixtures/",
  ]),
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mjs"],
        },
      },
    },
  },
  {
    // Tests and tooling run in Node, not inside Obsidian.
    files: ["test/**/*.ts", "vitest.config.ts", "eslint.config.mjs"],
    rules: {
      "import/no-nodejs-modules": "off",
      "obsidianmd/hardcoded-config-path": "off",
    },
  },
  prettier,
]);
