import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      exclude: [
        "coverage/**", // Exclude the coverage directory
        "dist/**", // Exclude the dist directory
        "*.config.ts", // Exclude config files
        "*.config.mjs", // Exclude config files
        "*.config.js", // Exclude config files
      ],
    },
  },
});
