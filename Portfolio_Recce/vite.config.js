import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // The client's raw footage in assets/videos uses an uppercase .MP4
  // extension; Vite's built-in asset regex is case-sensitive and only
  // matches lowercase .mp4, so without this the imports below fail to
  // resolve as static assets.
  assetsInclude: ["**/*.MP4"],

  server: {
    host: true, // allow network access
    port: 7203,

    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "all",

      // ✅ your domain(s)
      "portfolio-recce.nanashicollectibles.com",
      "devportfolio-recce.nanashicollectibles.com",
    ],
  },
});
