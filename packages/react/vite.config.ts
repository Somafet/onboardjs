import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import preserveUseClientDirective from "rollup-plugin-preserve-use-client";

export default defineConfig({
  plugins: [react(), preserveUseClientDirective()],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "OnboardJSReact",
      fileName: (format) => `index.${format}.js`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // Externalize peer deps (like react, react-dom)
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@onboardjs/core",
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
  },
});
