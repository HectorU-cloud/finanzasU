import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa"; // <-- Descomentado

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      includeAssets: ['apple-touch-icon.png'], // Si los tienes, si no, déjalo así
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
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: "NetworkOnly", // Así los datos de finanzas siempre son en vivo
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "lucide": ["lucide-react"],
          "icons": ["react-icons"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});