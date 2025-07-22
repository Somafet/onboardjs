import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"), // Entry point for library build
      name: "OnboardJSVisualizer",
      fileName: (format) => `index.${format}.js`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "@onboardjs/core"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "@onboardjs/core": "OnboardJSCore",
        },
      },
    },
    cssCodeSplit: true, // Crucial for CSS to be separate if you have one
  },
  // Ensure esbuild.wasm is copied to dist/public or served by dev server
  publicDir: "public", // If you have esbuild.wasm here
  assetsInclude: ["**/*.wasm"], // Ensure .wasm files are handled
});
