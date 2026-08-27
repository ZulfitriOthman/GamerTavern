import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: true, // allow network access
    port: 5173,

    // The hosted preview uses a dynamic *.e2b.app hostname.
    // `true` keeps the Vite preview accessible without hard-coding it.
    allowedHosts: true,
  },
});
