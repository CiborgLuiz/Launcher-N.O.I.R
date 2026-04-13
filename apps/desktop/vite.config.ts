import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@noir-app": path.resolve(__dirname, "src"),
      "@noir-ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@noir-shared": path.resolve(__dirname, "../../packages/shared/src")
    }
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "../..")]
    }
  },
  build: {
    outDir: path.resolve(__dirname, "../../dist/apps/desktop"),
    emptyOutDir: true
  }
});
