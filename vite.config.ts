import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

// #####################################################
// # FULL PRODUCTION VITE CONFIGURATION
// #####################################################

export default defineConfig({
  // Use "./" to ensure assets load correctly on any subpath or PWA environment
  base: "./",

  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    metaImagesPlugin(),
    // Conditional plugins for Replit environment
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer()
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner()
          ),
        ]
      : []),
  ],

  resolve: {
    alias: {
      // Directs "@" to your source folder
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },

  root: path.resolve(import.meta.dirname, "client"),

  build: {
    // FIX: We removed "external: ['react']" so React is bundled into the PWA
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false, // Set to true if you need to debug production errors
    rollupOptions: {
      // Ensure all necessary assets are bundled
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-leaflet", "leaflet"],
        },
      },
    },
  },

  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
