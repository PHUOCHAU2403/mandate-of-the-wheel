import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// Dev server stays on this machine with Vite's default host checks (no LAN exposure,
// no DNS-rebinding opening). The production build is static files with relative paths.
export default defineConfig(() => ({
  base: "./",
  server: {
    host: "localhost",
    port: 5173,
  },
  plugins: [react()],
}));
