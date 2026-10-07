import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      // Mirror esbuild's text loader for bundled starter presets.
      name: "markdown-as-text",
      transform(code, id) {
        if (id.endsWith(".md"))
          return { code: `export default ${JSON.stringify(code)};`, map: null };
        return null;
      },
    },
  ],
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: ["src/core/types.ts"],
      thresholds: { lines: 90 },
      reporter: ["text", "text-summary"],
    },
  },
});
