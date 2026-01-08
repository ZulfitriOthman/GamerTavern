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
      "tcg.b-jaur.com",
      "servers.b-jaur.com",

      // optional wildcard (subdomains)
      ".b-jaur.com",
    ],
  },
});
