import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Reads VITE_* variables from the single .env in the repo root. Only VITE_-prefixed values reach the browser.
export default defineConfig({
  envDir: "../..",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
});
