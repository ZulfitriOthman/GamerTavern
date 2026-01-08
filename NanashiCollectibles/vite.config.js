import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: true, // allow network access
    port: 5173,

    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "all",

      // ✅ your domain(s)
      "tcg.nanashicollectibles.com",
      "server.nanashicollectibles.com",

      // optional wildcard (subdomains)
      ".nanashicollectibles.com",
    ],
  },
});
