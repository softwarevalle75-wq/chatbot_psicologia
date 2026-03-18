import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  preview: {
    host: true,
    allowedHosts: [".up.railway.app"],
  },

  server: {
    proxy: {
      // API REST → backend puerto 3001
      "/api": {
        target:       "http://localhost:3001",
        changeOrigin: true,
      },
      // WebSocket del bot → bot puerto 3008
      "/ws": {
        target: "ws://localhost:3008",
        ws:     true,
      },
    },
  },
});
