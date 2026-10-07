import { defineConfig } from "vitest/config";

export default defineConfig({
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
