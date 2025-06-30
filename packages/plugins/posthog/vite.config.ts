import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  plugins: [],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "OnboardJSPostHogPlugin",
      fileName: (format) => `index.${format}.js`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@onboardjs/core",
        "posthog-js",
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "posthog-js": "posthog",
        },
      },
    },
  },
});
