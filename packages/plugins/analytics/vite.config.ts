import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  plugins: [],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "OnboardJSAnalyticsPlugin",
      fileName: (format) => `index.${format}.js`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["@onboardjs/core"],
    },
  },
});
