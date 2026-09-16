import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "icon-maskable-512.png"],
      manifest: {
        name: "Control de gastos",
        short_name: "Gastos",
        description: "Tus finanzas, sin depender de nadie más.",
        theme_color: "#1A1523",
        background_color: "#FEFAF5",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Cachea los archivos de la app para que abra rápido; las llamadas a /api
        // siempre van a la red (los datos financieros nunca deben venir de caché vieja).
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Todo lo que empiece con /api se redirige al backend FastAPI en local.
      "/api": "http://localhost:8000",
    },
  },
});
