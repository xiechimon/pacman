import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// PROTOTYPE sandbox (#909): standalone vite app, not part of the pnpm workspace.
// Port 5199 (strictPort) — never collides with dev:web 5173 / e2e 8398/8399.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@pacman/shared": path.resolve(__dirname, "src/shims/shared.ts"),
    },
  },
  server: {
    port: Number(process.env.T0909_PORT ?? 5199),
    strictPort: true,
  },
});
