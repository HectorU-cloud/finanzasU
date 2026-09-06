import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Todo lo que empiece con /api se redirige al backend FastAPI en local.
      "/api": "http://localhost:8000",
    },
  },
});
