
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "PuffPress",
        short_name: "PuffPress",
        description: "Your Files. Your Choice. Your Cloud.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#eaf7ff",
        theme_color: "#8ed4f2",
        icons: [
          {
            src: "/puffpress-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/puffpress-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/api(?:\/|$)/,
          /^\/ws(?:\/|$)/,
          /^\/pair\.html$/,
          /^\/device\.html$/
        ]
      }
    })
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      },
      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true
      }
    }
  },
  preview: {
  host: "127.0.0.1",
  port: 4173,
  strictPort: true,
  proxy: {
    "/api": {
      target: "http://127.0.0.1:8000",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, "")
    },
    "/ws": {
      target: "ws://127.0.0.1:8000",
      ws: true
    }
  }
}

});
