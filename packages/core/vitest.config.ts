import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      exclude: [
        "src/**/index.ts", // Exclude all barrel index.ts files
        "dist/**", // Exclude the dist directory
        "*.config.ts", // Exclude config files
      ],
    },
  },
});
