import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: true, // allow network access
    port: 5175,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "portfolio-jae.nanashicollectibles.com",
      ".nanashicollectibles.com",
    ],
  },

  preview: {
    host: true,
    port: 5175,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "portfolio-jae.nanashicollectibles.com",
      ".nanashicollectibles.com",
    ],
  },
});
